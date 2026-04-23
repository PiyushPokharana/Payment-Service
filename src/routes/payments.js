const express = require("express");
const paymentController = require("../controllers/paymentController");
const createIdempotencyMiddleware = require("../middleware/idempotency");

const router = express.Router();
const idempotency = createIdempotencyMiddleware();

router.post("/payments/process", idempotency, paymentController.processPayment);

module.exports = router;
