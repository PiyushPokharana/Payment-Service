const logger = require("../config/logger");

function errorHandler(error, req, res, next) {
    logger.error(
        {
            err: error,
            path: req.originalUrl,
            method: req.method
        },
        "Unhandled error"
    );

    const statusCode = error.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        message: statusCode === 500 ? "Internal server error" : error.message
    });
}

module.exports = errorHandler;
