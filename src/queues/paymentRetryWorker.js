const { Worker } = require("bullmq");
const logger = require("../config/logger");
const env = require("../config/env");
const paymentService = require("../services/paymentService");

let paymentRetryWorker = null;

function createPaymentRetryWorker() {
    paymentRetryWorker = new Worker(
        env.PAYMENT_RETRY_QUEUE_NAME,
        async (job) => {
            const { orderId, paymentMethod, simulationOutcome, attemptNumber } = job.data;

            logger.info(
                {
                    orderId,
                    paymentMethod,
                    jobId: job.id,
                    attempt: job.attemptsMade + 1,
                    maxAttempts: job.opts.attempts
                },
                "Processing payment retry"
            );

            try {
                const result = await paymentService.processPayment({
                    order_id: orderId,
                    payment_method: paymentMethod,
                    simulation_outcome: simulationOutcome
                });

                logger.info(
                    {
                        orderId,
                        jobId: job.id,
                        transactionId: result.transaction.id,
                        transactionStatus: result.transaction.status,
                        orderStatus: result.order.status
                    },
                    "Payment retry succeeded"
                );

                return {
                    success: true,
                    result
                };
            } catch (error) {
                const nextAttempt = job.attemptsMade + 1;

                if (nextAttempt >= job.opts.attempts) {
                    logger.error(
                        {
                            orderId,
                            jobId: job.id,
                            err: error,
                            finalAttempt: nextAttempt,
                            maxAttempts: job.opts.attempts
                        },
                        "Payment retry exhausted after maximum attempts"
                    );
                } else {
                    logger.warn(
                        {
                            orderId,
                            jobId: job.id,
                            err: error,
                            currentAttempt: nextAttempt,
                            maxAttempts: job.opts.attempts
                        },
                        "Payment retry failed, will retry"
                    );
                }

                throw error;
            }
        },
        {
            connection: {
                host: new URL(env.REDIS_URL).hostname,
                port: parseInt(new URL(env.REDIS_URL).port) || 6379
            },
            concurrency: env.PAYMENT_RETRY_WORKER_CONCURRENCY
        }
    );

    paymentRetryWorker.on("completed", (job, result) => {
        logger.debug(
            {
                jobId: job.id,
                result
            },
            "Payment retry job completed"
        );
    });

    paymentRetryWorker.on("failed", (job, error) => {
        logger.error(
            {
                jobId: job.id,
                err: error,
                attemptsMade: job.attemptsMade,
                maxAttempts: job.opts.attempts
            },
            "Payment retry job failed"
        );
    });

    return paymentRetryWorker;
}

async function startPaymentRetryWorker() {
    if (!paymentRetryWorker) {
        createPaymentRetryWorker();
    }

    logger.info(
        {
            concurrency: env.PAYMENT_RETRY_WORKER_CONCURRENCY,
            queueName: env.PAYMENT_RETRY_QUEUE_NAME
        },
        "Payment retry worker started"
    );
}

async function stopPaymentRetryWorker() {
    if (paymentRetryWorker) {
        await paymentRetryWorker.close();
        paymentRetryWorker = null;
        logger.info("Payment retry worker stopped");
    }
}

function getPaymentRetryWorker() {
    return paymentRetryWorker;
}

module.exports = {
    startPaymentRetryWorker,
    stopPaymentRetryWorker,
    getPaymentRetryWorker,
    createPaymentRetryWorker
};
