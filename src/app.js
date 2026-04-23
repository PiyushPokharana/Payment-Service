const path = require("path");
const express = require("express");
const healthRoutes = require("./routes/health");
const orderRoutes = require("./routes/orders");
const paymentRoutes = require("./routes/payments");
const webhookRoutes = require("./routes/webhook");
const dashboardRoutes = require("./routes/dashboard");
const requestLogger = require("./middleware/requestLogger");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(requestLogger);
app.use(webhookRoutes);
app.use(express.json());

// CORS for local development
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key, x-razorpay-signature");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }
    next();
});

// Serve static frontend files from the public/ directory
app.use(express.static(path.join(__dirname, "..", "public"), {
    index: "index.html",
    extensions: ["html"]
}));

app.use(healthRoutes);
app.use(orderRoutes);
app.use(paymentRoutes);
app.use(dashboardRoutes);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found"
    });
});

app.use(errorHandler);

module.exports = app;
