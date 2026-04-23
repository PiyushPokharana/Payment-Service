const { Queue } = require("bullmq");
const logger = require("../config/logger");
const env = require("../config/env");
const { safeRecordPaymentLog } = require("../services/paymentLogService");

let paymentDlqQueue = null;

function getPaymentDlqQueue() {
    if (!paymentDlqQueue) {
        paymentDlqQueue = new Queue(env.PAYMENT_DLQ_QUEUE_NAME, {
            connection: {
                host: new URL(env.REDIS_URL).hostname,
                port: parseInt(new URL(env.REDIS_URL).port) || 6379
            }
        });

        paymentDlqQueue.on("error", (error) => {
            logger.error({ err: error }, "Payment DLQ error");
        });
    }

    return paymentDlqQueue;
}

async function addPaymentToDlq(payload) {
    const {
        orderId,
        paymentMethod,
        simulationOutcome,
        errorMessage,
        attempts,
        maxAttempts,
        sourceJobId,
        failedAt
    } = payload;

    const dlqJob = await getPaymentDlqQueue().add(
        "payment-retry-exhausted",
        {
            orderId,
            paymentMethod,
            simulationOutcome,
            errorMessage,
            attempts,
            maxAttempts,
            sourceJobId,
            failedAt: failedAt || new Date().toISOString(),
            reprocessed: false,
            reprocessedAt: null,
            reprocessedRetryJobId: null
        },
        {
            removeOnComplete: false,
            removeOnFail: false
        }
    );

    logger.error(
        {
            dlqJobId: dlqJob.id,
            orderId,
            paymentMethod,
            sourceJobId,
            attempts,
            maxAttempts,
            errorMessage
        },
        "Payment moved to DLQ after retry exhaustion"
    );

    await safeRecordPaymentLog({
        orderId,
        eventType: "payment_moved_to_dlq",
        status: "failed",
        metadata: {
            dlqJobId: dlqJob.id,
            sourceJobId,
            paymentMethod,
            simulationOutcome,
            attempts,
            maxAttempts,
            reason: errorMessage
        }
    });

    return dlqJob;
}

async function listDlqJobs({ limit = 50, state = "waiting" } = {}) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
    const states = [state];
    const jobs = await getPaymentDlqQueue().getJobs(states, 0, safeLimit - 1, true);

    return jobs.map((job) => ({
        id: job.id,
        name: job.name,
        state,
        data: job.data,
        timestamp: job.timestamp
    }));
}

async function getDlqJobById(jobId) {
    const job = await getPaymentDlqQueue().getJob(jobId);
    return job || null;
}

async function reprocessDlqJob(jobId, simulationOutcomeOverride) {
    const dlqJob = await getDlqJobById(jobId);

    if (!dlqJob) {
        const notFoundError = new Error("DLQ job not found");
        notFoundError.statusCode = 404;
        throw notFoundError;
    }

    const payload = dlqJob.data || {};
    const simulationOutcome = simulationOutcomeOverride || payload.simulationOutcome;

    const { enqueuePaymentRetry } = require("./paymentRetryQueue");

    const retryJob = await enqueuePaymentRetry(
        payload.orderId,
        payload.paymentMethod,
        simulationOutcome
    );

    await dlqJob.updateData({
        ...payload,
        reprocessed: true,
        reprocessedAt: new Date().toISOString(),
        reprocessedRetryJobId: retryJob.id,
        reprocessSimulationOutcome: simulationOutcome
    });

    logger.info(
        {
            dlqJobId: dlqJob.id,
            retryJobId: retryJob.id,
            orderId: payload.orderId,
            simulationOutcome
        },
        "DLQ job reprocessed into payment retry queue"
    );

    await safeRecordPaymentLog({
        orderId: payload.orderId,
        eventType: "payment_dlq_reprocessed",
        status: "queued",
        metadata: {
            dlqJobId: dlqJob.id,
            retryJobId: retryJob.id,
            paymentMethod: payload.paymentMethod,
            simulationOutcome
        }
    });

    return {
        dlqJobId: dlqJob.id,
        retryJobId: retryJob.id,
        orderId: payload.orderId,
        paymentMethod: payload.paymentMethod,
        simulationOutcome
    };
}

async function closePaymentDlqQueue() {
    if (paymentDlqQueue) {
        await paymentDlqQueue.close();
        paymentDlqQueue = null;
    }
}

module.exports = {
    getPaymentDlqQueue,
    closePaymentDlqQueue,
    addPaymentToDlq,
    listDlqJobs,
    reprocessDlqJob
};
