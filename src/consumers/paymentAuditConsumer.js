const logger = require("../config/logger");
const env = require("../config/env");
const { redisClient } = require("../config/redis");
const { safeRecordPaymentLog } = require("../services/paymentLogService");
const {
    PAYMENT_EVENT_CHANNEL,
    validatePaymentEvent,
    paymentEventTypes
} = require("../events/paymentEvents");

const AUDIT_CONSUMER_NAME = "payment-audit-consumer";
const PROCESSED_EVENT_KEY_PREFIX = "payment-event:processed:";
const PROCESSED_EVENT_TTL_SECONDS = 60 * 60 * 24 * 7;

let paymentAuditSubscriber = null;

function getProcessedEventKey(eventId) {
    return `${PROCESSED_EVENT_KEY_PREFIX}${eventId}`;
}

function mapEventToAuditLogType(eventType) {
    switch (eventType) {
        case paymentEventTypes.SUCCESS:
            return "payment_event_success_consumed";
        case paymentEventTypes.FAILED:
        default:
            return "payment_event_failed_consumed";
    }
}

async function processPaymentEvent(message) {
    let parsedMessage;

    try {
        parsedMessage = JSON.parse(message);
    } catch (error) {
        logger.error({ err: error, message }, "Payment event consumer received invalid JSON");
        return;
    }

    const validationResult = validatePaymentEvent(parsedMessage);

    if (!validationResult.success) {
        logger.error(
            {
                issues: validationResult.error.issues,
                message: parsedMessage
            },
            "Payment event consumer received invalid event envelope"
        );
        return;
    }

    const event = validationResult.data;
    const processedEventKey = getProcessedEventKey(event.id);
    const claimResult = await redisClient.set(
        processedEventKey,
        JSON.stringify({
            eventId: event.id,
            eventType: event.type,
            claimedAt: new Date().toISOString(),
            source: event.source
        }),
        "NX",
        "EX",
        PROCESSED_EVENT_TTL_SECONDS
    );

    if (claimResult !== "OK") {
        logger.debug(
            {
                eventId: event.id,
                eventType: event.type,
                source: event.source
            },
            "Payment event consumer skipped duplicate event"
        );
        return;
    }

    try {
        await safeRecordPaymentLog({
            orderId: event.payload.orderId,
            transactionId: event.payload.transactionId || null,
            eventType: mapEventToAuditLogType(event.type),
            status: "processed",
            metadata: {
                eventId: event.id,
                eventType: event.type,
                version: event.version,
                source: event.source,
                payload: event.payload
            }
        });

        await redisClient.set(
            processedEventKey,
            JSON.stringify({
                eventId: event.id,
                eventType: event.type,
                processedAt: new Date().toISOString(),
                source: event.source
            }),
            "EX",
            PROCESSED_EVENT_TTL_SECONDS
        );

        logger.info(
            {
                eventId: event.id,
                eventType: event.type,
                orderId: event.payload.orderId,
                transactionId: event.payload.transactionId || null
            },
            "Payment audit event consumed"
        );
    } catch (error) {
        await redisClient.del(processedEventKey);

        logger.error(
            {
                err: error,
                eventId: event.id,
                eventType: event.type,
                orderId: event.payload.orderId
            },
            "Payment audit consumer failed"
        );
    }
}

async function startPaymentAuditConsumer() {
    if (paymentAuditSubscriber) {
        return;
    }

    paymentAuditSubscriber = redisClient.duplicate({
        lazyConnect: true
    });

    paymentAuditSubscriber.on("error", (error) => {
        logger.error({ err: error }, "Payment audit subscriber error");
    });

    paymentAuditSubscriber.on("message", (channel, message) => {
        if (channel !== PAYMENT_EVENT_CHANNEL) {
            return;
        }

        void processPaymentEvent(message);
    });

    await paymentAuditSubscriber.connect();
    await paymentAuditSubscriber.subscribe(PAYMENT_EVENT_CHANNEL);

    logger.info(
        {
            consumerName: AUDIT_CONSUMER_NAME,
            channel: PAYMENT_EVENT_CHANNEL,
            environment: env.NODE_ENV
        },
        "Payment audit consumer started"
    );
}

async function stopPaymentAuditConsumer() {
    if (!paymentAuditSubscriber) {
        return;
    }

    await paymentAuditSubscriber.unsubscribe(PAYMENT_EVENT_CHANNEL);
    await paymentAuditSubscriber.disconnect();
    paymentAuditSubscriber = null;

    logger.info(
        {
            consumerName: AUDIT_CONSUMER_NAME,
            channel: PAYMENT_EVENT_CHANNEL
        },
        "Payment audit consumer stopped"
    );
}

module.exports = {
    startPaymentAuditConsumer,
    stopPaymentAuditConsumer
};