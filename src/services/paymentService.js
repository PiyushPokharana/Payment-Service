const { randomUUID } = require("crypto");
const { z } = require("zod");
const logger = require("../config/logger");
const orderModel = require("../models/orderModel");
const transactionModel = require("../models/transactionModel");
const { recordPaymentLog, safeRecordPaymentLog } = require("./paymentLogService");
const { paymentEventTypes, publishPaymentEvent } = require("./paymentEventBusService");

const supportedPaymentMethods = new Set([
    "card",
    "upi",
    "netbanking",
    "wallet"
]);

const simulationOutcomeValues = ["success", "failure", "timeout"];

const processPaymentSchema = z.object({
    order_id: z
        .string({
            invalid_type_error: "order_id must be a UUID string"
        })
        .uuid("order_id must be a valid UUID"),
    payment_method: z
        .string({
            invalid_type_error: "payment_method must be a string"
        })
        .trim()
        .toLowerCase()
        .refine(
            (value) => supportedPaymentMethods.has(value),
            "payment_method is not supported"
        ),
    simulation_outcome: z
        .enum(simulationOutcomeValues)
        .optional()
});

function validateProcessPaymentPayload(payload) {
    return processPaymentSchema.safeParse(payload);
}

function resolvePaymentOutcome(payloadOutcome) {
    if (payloadOutcome) {
        return payloadOutcome;
    }

    const randomIndex = Math.floor(Math.random() * simulationOutcomeValues.length);
    return simulationOutcomeValues[randomIndex];
}

function mapOutcomeToStatuses(outcome) {
    switch (outcome) {
        case "success":
            return {
                transactionStatus: "success",
                orderStatus: "paid"
            };
        case "failure":
            return {
                transactionStatus: "failed",
                orderStatus: "failed"
            };
        case "timeout":
        default:
            return {
                transactionStatus: "timeout",
                orderStatus: "pending"
            };
    }
}

async function processPayment(payload, options = {}) {
    const { shouldEnqueueRetry = true } = options;

    const order = await orderModel.getOrderById(payload.order_id);

    if (!order) {
        const notFoundError = new Error("Order not found");
        notFoundError.statusCode = 404;
        throw notFoundError;
    }

    const outcome = resolvePaymentOutcome(payload.simulation_outcome);
    const statusMapping = mapOutcomeToStatuses(outcome);
    const attemptCount = await transactionModel.getNextAttemptCount(
        payload.order_id,
        payload.payment_method
    );

    await recordPaymentLog({
        orderId: payload.order_id,
        eventType: "payment_attempt_started",
        status: "in_progress",
        metadata: {
            paymentMethod: payload.payment_method,
            attemptCount,
            simulationOutcome: outcome
        }
    });

    const createdTransaction = await transactionModel.createTransaction({
        id: randomUUID(),
        orderId: payload.order_id,
        status: statusMapping.transactionStatus,
        paymentMethod: payload.payment_method,
        attemptCount
    });

    const updatedOrder = await orderModel.updateOrderStatus(
        payload.order_id,
        statusMapping.orderStatus
    );

    await recordPaymentLog({
        orderId: payload.order_id,
        transactionId: createdTransaction.id,
        eventType: "payment_attempt_completed",
        status: createdTransaction.status,
        metadata: {
            paymentMethod: payload.payment_method,
            attemptCount,
            simulationOutcome: outcome,
            orderStatus: updatedOrder.status
        }
    });

    logger.info(
        {
            orderId: payload.order_id,
            transactionId: createdTransaction.id,
            paymentMethod: payload.payment_method,
            attemptCount,
            simulationOutcome: outcome,
            transactionStatus: createdTransaction.status,
            orderStatus: updatedOrder.status
        },
        "Payment processing simulation completed"
    );

    if (createdTransaction.status === "success") {
        await publishPaymentEvent(
            paymentEventTypes.SUCCESS,
            {
                orderId: payload.order_id,
                transactionId: createdTransaction.id,
                paymentMethod: payload.payment_method,
                attemptCount,
                simulationOutcome: outcome,
                orderStatus: updatedOrder.status,
                transactionStatus: createdTransaction.status
            },
            "payment-service"
        );
    }

    // Enqueue retry if outcome is failure/timeout and shouldEnqueueRetry is true
    let queuedRetryJob = null;

    if (shouldEnqueueRetry && (outcome === "failure" || outcome === "timeout")) {
        try {
            const { enqueuePaymentRetry } = require("./paymentRetryService");
            queuedRetryJob = await enqueuePaymentRetry(
                payload.order_id,
                payload.payment_method,
                outcome
            );

            await safeRecordPaymentLog({
                orderId: payload.order_id,
                transactionId: createdTransaction.id,
                eventType: "payment_retry_enqueued",
                status: "queued",
                metadata: {
                    paymentMethod: payload.payment_method,
                    simulationOutcome: outcome,
                    retryJobId: queuedRetryJob.id
                }
            });
        } catch (error) {
            logger.error(
                {
                    err: error,
                    orderId: payload.order_id,
                    transactionId: createdTransaction.id
                },
                "Failed to enqueue payment for retry, but transaction was recorded"
            );
        }
    }

    return {
        simulation_outcome: outcome,
        transaction: createdTransaction,
        order: updatedOrder,
        queued_for_retry: Boolean(queuedRetryJob)
    };
}

module.exports = {
    processPayment,
    validateProcessPaymentPayload,
    supportedPaymentMethods,
    simulationOutcomeValues
};
