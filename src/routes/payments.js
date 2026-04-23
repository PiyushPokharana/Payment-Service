const express = require("express");
const paymentController = require("../controllers/paymentController");
const createIdempotencyMiddleware = require("../middleware/idempotency");

const router = express.Router();
const idempotency = createIdempotencyMiddleware();

router.post("/payments/process", idempotency, paymentController.processPayment);
router.get("/payments/dlq", paymentController.listDlqJobs);
router.post("/payments/dlq/:jobId/reprocess", paymentController.reprocessDlqJob);

module.exports = router;
