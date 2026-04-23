const express = require("express");
const webhookController = require("../controllers/webhookController");

const router = express.Router();

router.post(
    "/webhook/payment",
    express.raw({ type: "*/*", limit: "1mb" }),
    webhookController.handlePaymentWebhook
);

module.exports = router;
