const { Queue } = require("bullmq");
const logger = require("../config/logger");
const env = require("../config/env");

let paymentRetryQueue = null;

function getPaymentRetryQueue() {
    if (!paymentRetryQueue) {
        paymentRetryQueue = new Queue(env.PAYMENT_RETRY_QUEUE_NAME, {
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
    }

    return paymentRetryQueue;
}

async function enqueuePaymentRetry(orderId, paymentMethod, simulationOutcome) {
    try {
        const job = await getPaymentRetryQueue().add(
            "process-payment-retry",
            {
                orderId,
                paymentMethod,
                simulationOutcome
            },
            {
                attempts: env.PAYMENT_RETRY_MAX_ATTEMPTS,
                backoff: {
                    type: "custom"
                },
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

async function closePaymentRetryQueue() {
    if (paymentRetryQueue) {
        await paymentRetryQueue.close();
        paymentRetryQueue = null;
    }
}

module.exports = {
    getPaymentRetryQueue,
    closePaymentRetryQueue,
    enqueuePaymentRetry
};
