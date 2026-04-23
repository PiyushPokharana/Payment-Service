const { randomUUID } = require("crypto");
const { z } = require("zod");

const PAYMENT_EVENT_CHANNEL = "payment-events";
const PAYMENT_EVENT_SCHEMA_VERSION = "1.0.0";

const paymentEventTypes = {
    SUCCESS: "payment_success",
    FAILED: "payment_failed"
};

const paymentEventEnvelopeSchema = z.object({
    id: z.string().uuid(),
    type: z.enum([paymentEventTypes.SUCCESS, paymentEventTypes.FAILED]),
    version: z.string().min(1),
    source: z.string().min(1),
    occurredAt: z.string().datetime(),
    payload: z
        .object({
            orderId: z.string().uuid(),
            transactionId: z.string().uuid().nullable().optional()
        })
        .passthrough()
});

function createPaymentEvent(type, payload, source = "payment-service") {
    return {
        id: randomUUID(),
        type,
        version: PAYMENT_EVENT_SCHEMA_VERSION,
        source,
        occurredAt: new Date().toISOString(),
        payload
    };
}

function validatePaymentEvent(rawEvent) {
    return paymentEventEnvelopeSchema.safeParse(rawEvent);
}

module.exports = {
    PAYMENT_EVENT_CHANNEL,
    PAYMENT_EVENT_SCHEMA_VERSION,
    paymentEventTypes,
    createPaymentEvent,
    validatePaymentEvent
};