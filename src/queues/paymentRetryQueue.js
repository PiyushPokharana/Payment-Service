const { Queue } = require("bullmq");
const logger = require("../config/logger");
const env = require("../config/env");
const { redisClient } = require("../config/redis");

const paymentRetryQueue = new Queue(env.PAYMENT_RETRY_QUEUE_NAME, {
    connection: {
        host: new URL(env.REDIS_URL).hostname,
        port: parseInt(new URL(env.REDIS_URL).port) || 6379
    }
});

paymentRetryQueue.on("error", (error) => {
    logger.error({ err: error }, "Payment retry queue error");
});

paymentRetryQueue.on("failed", (job, error) => {
    logger.error(
        {
            jobId: job.id,
            jobData: job.data,
            err: error
        },
        "Payment retry job permanently failed"
    );
});

async function enqueuePaymentRetry(orderId, paymentMethod, simulationOutcome) {
    try {
        // Exponential backoff delays: 1s, 5s, 15s
        const backoffFunction = (attemptsMade) => {
            const delays = [1000, 5000, 15000];
            return delays[Math.min(attemptsMade, delays.length - 1)];
        };

        const job = await paymentRetryQueue.add(
            "process-payment-retry",
            {
                orderId,
                paymentMethod,
                simulationOutcome,
                attemptNumber: 0
            },
            {
                attempts: env.PAYMENT_RETRY_MAX_ATTEMPTS,
                backoff: {
                    type: "custom"
                },
                delay: 1000, // Initial delay before first retry
                removeOnComplete: true,
                removeOnFail: false
            }
        );

        logger.info(
            {
                orderId,
                paymentMethod,
                jobId: job.id,
                maxRetries: env.PAYMENT_RETRY_MAX_ATTEMPTS,
                backoffPattern: "1s, 5s, 15s exponential"
            },
            "Payment retry job enqueued with exponential backoff"
        );

        return job;
    } catch (error) {
        logger.error(
            {
                err: error,
                orderId,
                paymentMethod
            },
            "Failed to enqueue payment retry"
        );
        throw error;
    }
}

module.exports = {
    paymentRetryQueue,
    enqueuePaymentRetry
};
