const logger = require("../config/logger");
const orderService = require("../services/orderService");

async function createOrder(req, res, next) {
    const validationResult = orderService.validateCreateOrderPayload(req.body);

    if (!validationResult.success) {
        logger.warn(
            {
                issues: validationResult.error.issues
            },
            "Order creation payload validation failed"
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
        const order = await orderService.createOrder(validationResult.data);

        return res.status(201).json({
            success: true,
            message: "Order created successfully",
            data: order
        });
    } catch (error) {
        logger.error(
            {
                err: error,
                requestBody: req.body
            },
            "Order creation failed"
        );

        return next(error);
    }
}

module.exports = {
    createOrder
};
