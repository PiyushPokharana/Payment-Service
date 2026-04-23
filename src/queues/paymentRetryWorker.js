const { Worker } = require("bullmq");
const logger = require("../config/logger");
const env = require("../config/env");
const paymentService = require("../services/paymentService");
const orderModel = require("../models/orderModel");
const { addPaymentToDlq } = require("./paymentDlqQueue");
const { safeRecordPaymentLog } = require("../services/paymentLogService");
const { paymentEventTypes, publishPaymentEvent } = require("../services/paymentEventBusService");

let paymentRetryWorker = null;

function createPaymentRetryWorker() {
    const retryDelaysMs = [1000, 5000, 15000];

    paymentRetryWorker = new Worker(
        env.PAYMENT_RETRY_QUEUE_NAME,
        async (job) => {
            const { orderId, paymentMethod, simulationOutcome } = job.data;

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

            await safeRecordPaymentLog({
                orderId,
                eventType: "payment_retry_started",
                status: "in_progress",
                metadata: {
                    jobId: job.id,
                    paymentMethod,
                    attempt: job.attemptsMade + 1,
                    maxAttempts: job.opts.attempts,
                    simulationOutcome
                }
            });

            try {
                const result = await paymentService.processPayment({
                    order_id: orderId,
                    payment_method: paymentMethod,
                    simulation_outcome: simulationOutcome
                }, {
                    shouldEnqueueRetry: false
                });

                if (result.simulation_outcome !== "success") {
                    throw new Error(
                        `Retry attempt did not succeed (outcome=${result.simulation_outcome})`
                    );
                }

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

                await safeRecordPaymentLog({
                    orderId,
                    transactionId: result.transaction.id,
                    eventType: "payment_retry_succeeded",
                    status: "success",
                    metadata: {
                        jobId: job.id,
                        paymentMethod,
                        attempt: job.attemptsMade + 1,
                        maxAttempts: job.opts.attempts,
                        simulationOutcome
                    }
                });

                return {
                    success: true,
                    result
                };
            } catch (error) {
                const nextAttempt = job.attemptsMade + 1;

                if (nextAttempt >= job.opts.attempts) {
                    const exhaustedErrorMessage = error?.message || "Unknown retry failure";

                    await orderModel.updateOrderStatus(orderId, "failed");
                    await addPaymentToDlq({
                        orderId,
                        paymentMethod,
                        simulationOutcome,
                        errorMessage: exhaustedErrorMessage,
                        attempts: nextAttempt,
                        maxAttempts: job.opts.attempts,
                        sourceJobId: job.id,
                        failedAt: new Date().toISOString()
                    });

                    await publishPaymentEvent(
                        paymentEventTypes.FAILED,
                        {
                            orderId,
                            transactionId: null,
                            paymentMethod,
                            simulationOutcome,
                            attempts: nextAttempt,
                            maxAttempts: job.opts.attempts,
                            sourceJobId: job.id,
                            reason: exhaustedErrorMessage,
                            orderStatus: "failed"
                        },
                        "payment-retry-worker"
                    );

                    logger.error(
                        {
                            orderId,
                            jobId: job.id,
                            err: error,
                            finalAttempt: nextAttempt,
                            maxAttempts: job.opts.attempts,
                            simulationOutcome,
                            finalFailureReason: exhaustedErrorMessage
                        },
                        "Payment retry exhausted after maximum attempts"
                    );

                    await safeRecordPaymentLog({
                        orderId,
                        eventType: "payment_retry_exhausted",
                        status: "failed",
                        metadata: {
                            jobId: job.id,
                            paymentMethod,
                            attempts: nextAttempt,
                            maxAttempts: job.opts.attempts,
                            simulationOutcome,
                            reason: exhaustedErrorMessage
                        }
                    });
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

                    await safeRecordPaymentLog({
                        orderId,
                        eventType: "payment_retry_failed",
                        status: "retrying",
                        metadata: {
                            jobId: job.id,
                            paymentMethod,
                            currentAttempt: nextAttempt,
                            maxAttempts: job.opts.attempts,
                            simulationOutcome,
                            reason: error?.message || "Retry attempt failed"
                        }
                    });
                }

                throw error;
            }
        },
        {
            connection: {
                host: new URL(env.REDIS_URL).hostname,
                port: parseInt(new URL(env.REDIS_URL).port) || 6379
            },
            concurrency: env.PAYMENT_RETRY_WORKER_CONCURRENCY,
            settings: {
                backoffStrategy: (attemptsMade, type) => {
                    if (type === "custom") {
                        const delayIndex = Math.max(0, Math.min(attemptsMade - 1, retryDelaysMs.length - 1));
                        return retryDelaysMs[delayIndex];
                    }

                    return 0;
                }
            }
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
