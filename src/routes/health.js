const express = require("express");

const router = express.Router();

router.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        service: "payment-service",
        status: "ok",
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
