const pinoHttp = require("pino-http");
const logger = require("../config/logger");

const requestLogger = pinoHttp({
    logger
});

module.exports = requestLogger;
