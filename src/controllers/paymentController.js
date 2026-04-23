const logger = require("../config/logger");
const paymentService = require("../services/paymentService");

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
    processPayment
};
