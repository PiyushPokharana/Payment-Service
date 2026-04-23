const logger = require("../config/logger");
const { redisClient } = require("../config/redis");
const {
    PAYMENT_EVENT_CHANNEL,
    createPaymentEvent,
    paymentEventTypes
} = require("../events/paymentEvents");

let paymentEventPublisher = null;

function getPaymentEventPublisher() {
    if (!paymentEventPublisher) {
        paymentEventPublisher = redisClient.duplicate({
            lazyConnect: true
        });

        paymentEventPublisher.on("error", (error) => {
            logger.error({ err: error }, "Payment event publisher error");
        });
    }

    return paymentEventPublisher;
}

async function ensurePaymentEventPublisherConnected() {
    const publisher = getPaymentEventPublisher();

    if (publisher.status === "end") {
        throw new Error("Payment event publisher is closed");
    }

    if (publisher.status === "wait" || publisher.status === "connecting") {
        await publisher.connect();
    }

    return publisher;
}

async function publishPaymentEvent(type, payload, source = "payment-service") {
    try {
        const publisher = await ensurePaymentEventPublisherConnected();
        const event = createPaymentEvent(type, payload, source);

        await publisher.publish(PAYMENT_EVENT_CHANNEL, JSON.stringify(event));

        logger.info(
            {
                eventId: event.id,
                eventType: event.type,
                version: event.version,
                source: event.source,
                orderId: event.payload?.orderId,
                transactionId: event.payload?.transactionId || null
            },
            "Published payment event"
        );

        return event;
    } catch (error) {
        logger.error(
            {
                err: error,
                eventType: type,
                source,
                orderId: payload?.orderId,
                transactionId: payload?.transactionId || null
            },
            "Failed to publish payment event"
        );

        return null;
    }
}

async function shutdownPaymentEventBus() {
    if (paymentEventPublisher) {
        await paymentEventPublisher.disconnect();
        paymentEventPublisher = null;
    }
}

module.exports = {
    paymentEventTypes,
    publishPaymentEvent,
    shutdownPaymentEventBus
};