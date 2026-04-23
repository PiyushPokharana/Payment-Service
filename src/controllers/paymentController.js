const logger = require("../config/logger");
const paymentService = require("../services/paymentService");
const dlqService = require("../services/dlqService");

async function processPayment(req, res, next) {
    const validationResult = paymentService.validateProcessPaymentPayload(req.body);

    if (!validationResult.success) {
        logger.warn(
            {
                issues: validationResult.error.issues
            },
            "Payment processing payload validation failed"
        );

        return res.status(400).json({
            success: false,
            message: "Invalid request payload",
            errors: validationResult.error.issues.map((issue) => ({
                field: issue.path.join("."),
                message: issue.message
            }))
        });
    }

    try {
        const result = await paymentService.processPayment(validationResult.data);

        return res.status(200).json({
            success: true,
            message: "Payment processed",
            data: result
        });
    } catch (error) {
        logger.error(
            {
                err: error,
                requestBody: req.body
            },
            "Payment processing failed"
        );

        return next(error);
    }
}

module.exports = {
    processPayment,
    listDlqJobs,
    reprocessDlqJob
};

async function listDlqJobs(req, res, next) {
    const validationResult = dlqService.validateDlqListQuery(req.query);

    if (!validationResult.success) {
        return res.status(400).json({
            success: false,
            message: "Invalid query parameters",
            errors: validationResult.error.issues.map((issue) => ({
                field: issue.path.join("."),
                message: issue.message
            }))
        });
    }

    try {
        const jobs = await dlqService.listDlqJobs(validationResult.data);
        return res.status(200).json({
            success: true,
            message: "DLQ jobs fetched",
            data: {
                count: jobs.length,
                jobs
            }
        });
    } catch (error) {
        logger.error({ err: error, query: req.query }, "Failed to fetch DLQ jobs");
        return next(error);
    }
}

async function reprocessDlqJob(req, res, next) {
    const { jobId } = req.params;
    const validationResult = dlqService.validateDlqReprocessPayload(req.body);

    if (!validationResult.success) {
        return res.status(400).json({
            success: false,
            message: "Invalid request payload",
            errors: validationResult.error.issues.map((issue) => ({
                field: issue.path.join("."),
                message: issue.message
            }))
        });
    }

    try {
        const result = await dlqService.reprocessDlqJob(jobId, validationResult.data);
        return res.status(200).json({
            success: true,
            message: "DLQ job reprocessed",
            data: result
        });
    } catch (error) {
        logger.error({ err: error, jobId }, "Failed to reprocess DLQ job");
        return next(error);
    }
}
