const crypto = require("crypto");
const { randomUUID } = require("crypto");
const { z } = require("zod");
const logger = require("../config/logger");
const env = require("../config/env");
const { pool } = require("../config/database");
const orderModel = require("../models/orderModel");
const webhookEventModel = require("../models/webhookEventModel");

const orderStatusValues = ["pending", "paid", "failed"];

const normalizedWebhookSchema = z.object({
    eventId: z.string().trim().min(1, "event id is required"),
    eventType: z.string().trim().min(1, "event type is required"),
    orderId: z.string().uuid("order_id must be a valid UUID"),
    status: z.enum(orderStatusValues)
});

function buildExpectedSignature(rawBody, secret) {
    return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

function verifyWebhookSignature(rawBody, signature) {
    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
        return false;
    }

    if (!signature || typeof signature !== "string") {
        return false;
    }

    const expectedSignature = buildExpectedSignature(rawBody, env.WEBHOOK_SECRET);
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const actualBuffer = Buffer.from(signature.trim(), "hex");

    if (expectedBuffer.length !== actualBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function mapEventToOrderStatus(eventType) {
    const lowerEvent = (eventType || "").toLowerCase();

    if (lowerEvent.includes("captured") || lowerEvent.includes("success")) {
        return "paid";
    }

    if (lowerEvent.includes("failed")) {
        return "failed";
    }

    return "pending";
}

function normalizeWebhookPayload(payload) {
    const paymentEntity = payload?.payload?.payment?.entity || {};
    const notes = paymentEntity?.notes || {};

    const eventId = payload?.event_id || payload?.id;
    const eventType = payload?.event || payload?.type || "payment.unknown";
    const orderId = payload?.order_id || paymentEntity?.order_id || notes?.order_id;
    const status = payload?.status || mapEventToOrderStatus(eventType);

    return {
        eventId,
        eventType,
        orderId,
        status
    };
}

function parseWebhookPayload(rawBody) {
    try {
        const parsed = JSON.parse(rawBody.toString("utf8"));
        return {
            success: true,
            payload: parsed
        };
    } catch (error) {
        return {
            success: false,
            payload: null,
            error
        };
    }
}

async function recordWebhookDecision(entry, client) {
    return webhookEventModel.insertWebhookEvent(
        {
            id: randomUUID(),
            eventId: entry.eventId,
            eventType: entry.eventType,
            orderId: entry.orderId,
            decision: entry.decision,
            reason: entry.reason,
            signatureValid: entry.signatureValid,
            payload: entry.payload
        },
        client
    );
}

async function processPaymentWebhook({ rawBody, signature }) {
    const signatureValid = verifyWebhookSignature(rawBody, signature);

    if (!signatureValid) {
        await recordWebhookDecision({
            eventId: null,
            eventType: "unknown",
            orderId: null,
            decision: "rejected_signature",
            reason: "Invalid or missing x-razorpay-signature",
            signatureValid: false,
            payload: null
        });

        logger.warn(
            {
                audit: "webhook_decision",
                decision: "rejected_signature"
            },
            "Webhook rejected due to invalid signature"
        );

        return {
            status: "invalid_signature"
        };
    }

    const parsedPayloadResult = parseWebhookPayload(rawBody);

    if (!parsedPayloadResult.success) {
        await recordWebhookDecision({
            eventId: null,
            eventType: "unknown",
            orderId: null,
            decision: "rejected_payload",
            reason: "Malformed JSON payload",
            signatureValid: true,
            payload: null
        });

        logger.warn(
            {
                audit: "webhook_decision",
                decision: "rejected_payload"
            },
            "Webhook rejected due to malformed JSON payload"
        );

        return {
            status: "invalid_payload",
            errors: [
                {
                    field: "body",
                    message: "Payload must be valid JSON"
                }
            ]
        };
    }

    const normalizedPayload = normalizeWebhookPayload(parsedPayloadResult.payload);
    const validationResult = normalizedWebhookSchema.safeParse(normalizedPayload);

    if (!validationResult.success) {
        const validationErrors = validationResult.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message
        }));

        await recordWebhookDecision({
            eventId: normalizedPayload.eventId || null,
            eventType: normalizedPayload.eventType || "unknown",
            orderId: null,
            decision: "rejected_payload",
            reason: "Payload validation failed",
            signatureValid: true,
            payload: parsedPayloadResult.payload
        });

        logger.warn(
            {
                audit: "webhook_decision",
                decision: "rejected_payload",
                eventId: normalizedPayload.eventId,
                errors: validationErrors
            },
            "Webhook rejected due to payload validation"
        );

        return {
            status: "invalid_payload",
            errors: validationErrors
        };
    }

    const normalized = validationResult.data;

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        await recordWebhookDecision(
            {
                eventId: normalized.eventId,
                eventType: normalized.eventType,
                orderId: normalized.orderId,
                decision: "accepted",
                reason: "Webhook signature and payload validated",
                signatureValid: true,
                payload: parsedPayloadResult.payload
            },
            client
        );

        const updatedOrder = await orderModel.updateOrderStatus(
            normalized.orderId,
            normalized.status
        );

        if (!updatedOrder) {
            await client.query("ROLLBACK");

            await recordWebhookDecision({
                eventId: normalized.eventId,
                eventType: normalized.eventType,
                orderId: normalized.orderId,
                decision: "rejected_not_found",
                reason: "Order does not exist",
                signatureValid: true,
                payload: parsedPayloadResult.payload
            });

            logger.warn(
                {
                    audit: "webhook_decision",
                    decision: "rejected_not_found",
                    eventId: normalized.eventId,
                    orderId: normalized.orderId
                },
                "Webhook rejected because order was not found"
            );

            return {
                status: "order_not_found"
            };
        }

        await client.query("COMMIT");

        logger.info(
            {
                audit: "webhook_decision",
                decision: "accepted",
                eventId: normalized.eventId,
                orderId: normalized.orderId,
                orderStatus: updatedOrder.status
            },
            "Webhook accepted and processed"
        );

        return {
            status: "accepted",
            eventId: normalized.eventId,
            order: updatedOrder
        };
    } catch (error) {
        await client.query("ROLLBACK");

        if (error.code === "23505") {
            await recordWebhookDecision({
                eventId: normalized.eventId,
                eventType: normalized.eventType,
                orderId: normalized.orderId,
                decision: "rejected_duplicate",
                reason: "Duplicate webhook event id",
                signatureValid: true,
                payload: parsedPayloadResult.payload
            });

            logger.warn(
                {
                    audit: "webhook_decision",
                    decision: "rejected_duplicate",
                    eventId: normalized.eventId,
                    orderId: normalized.orderId
                },
                "Duplicate webhook event rejected"
            );

            return {
                status: "duplicate",
                eventId: normalized.eventId
            };
        }

        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    processPaymentWebhook,
    verifyWebhookSignature,
    normalizeWebhookPayload,
    mapEventToOrderStatus
};
