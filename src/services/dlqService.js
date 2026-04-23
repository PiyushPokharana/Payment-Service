const { z } = require("zod");
const logger = require("../config/logger");
const dlqQueue = require("../queues/paymentDlqQueue");

const dlqListQuerySchema = z.object({
    state: z.enum(["waiting", "delayed", "active", "completed", "failed"]).default("waiting"),
    limit: z.coerce.number().int().positive().max(100).default(50)
});

const dlqReprocessSchema = z.object({
    simulation_outcome: z.enum(["success", "failure", "timeout"]).optional()
});

function validateDlqListQuery(query) {
    return dlqListQuerySchema.safeParse(query);
}

function validateDlqReprocessPayload(payload) {
    return dlqReprocessSchema.safeParse(payload || {});
}

async function listDlqJobs(query) {
    const jobs = await dlqQueue.listDlqJobs(query);
    return jobs;
}

async function reprocessDlqJob(jobId, payload) {
    try {
        return await dlqQueue.reprocessDlqJob(jobId, payload.simulation_outcome);
    } catch (error) {
        logger.error(
            {
                err: error,
                jobId,
                payload
            },
            "Failed to reprocess DLQ job"
        );
        throw error;
    }
}

module.exports = {
    validateDlqListQuery,
    validateDlqReprocessPayload,
    listDlqJobs,
    reprocessDlqJob
};
