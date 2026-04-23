const express = require("express");
const healthRoutes = require("./routes/health");
const requestLogger = require("./middleware/requestLogger");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(express.json());
app.use(requestLogger);
app.use(healthRoutes);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found"
    });
});

app.use(errorHandler);

module.exports = app;
