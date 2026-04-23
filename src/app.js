const express = require("express");
const healthRoutes = require("./routes/health");
const orderRoutes = require("./routes/orders");
const paymentRoutes = require("./routes/payments");
const webhookRoutes = require("./routes/webhook");
const requestLogger = require("./middleware/requestLogger");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(requestLogger);
app.use(webhookRoutes);
app.use(express.json());
app.use(healthRoutes);
app.use(orderRoutes);
app.use(paymentRoutes);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found"
    });
});

app.use(errorHandler);

module.exports = app;
