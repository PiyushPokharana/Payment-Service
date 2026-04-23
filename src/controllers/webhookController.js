const logger = require("../config/logger");
const webhookService = require("../services/webhookService");

async function handlePaymentWebhook(req, res, next) {
    const signature = req.get("x-razorpay-signature") || "";

    try {
        const result = await webhookService.processPaymentWebhook({
            rawBody: req.body,
            signature
        });

        if (result.status === "accepted") {
            return res.status(200).json({
                success: true,
                message: "Webhook accepted",
                data: {
                    event_id: result.eventId,
                    decision: result.status,
                    order: result.order
                }
            });
        }

        if (result.status === "duplicate") {
            return res.status(409).json({
                success: false,
                message: "Duplicate webhook event",
                data: {
                    event_id: result.eventId,
                    decision: result.status
                }
            });
        }

        if (result.status === "invalid_signature") {
            return res.status(401).json({
                success: false,
                message: "Invalid webhook signature"
            });
        }

        if (result.status === "invalid_payload") {
            return res.status(400).json({
                success: false,
                message: "Invalid webhook payload",
                errors: result.errors
            });
        }

        if (result.status === "order_not_found") {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unexpected webhook processing state"
        });
    } catch (error) {
        logger.error(
            {
                err: error,
                path: req.originalUrl
            },
            "Webhook processing failed"
        );

        return next(error);
    }
}

module.exports = {
    handlePaymentWebhook
};
