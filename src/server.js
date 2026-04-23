require("dotenv").config();

const app = require("./app");
const env = require("./config/env");
const logger = require("./config/logger");
const { verifyPostgresConnection, pool } = require("./config/database");
const { verifyRedisConnection, redisClient } = require("./config/redis");
const { startPaymentRetryWorker, stopPaymentRetryWorker } = require("./queues/paymentRetryWorker");
const { closePaymentRetryQueue } = require("./queues/paymentRetryQueue");
const { closePaymentDlqQueue } = require("./queues/paymentDlqQueue");
const { startPaymentAuditConsumer, stopPaymentAuditConsumer } = require("./consumers/paymentAuditConsumer");
const { shutdownPaymentEventBus } = require("./services/paymentEventBusService");

async function startServer() {
    try {
        if (env.ENABLE_STARTUP_CONNECTION_CHECKS) {
            await verifyPostgresConnection();
            await verifyRedisConnection();
        } else {
            logger.warn("Startup DB/Redis checks are disabled");
        }

        // Start the payment retry worker
        await startPaymentRetryWorker();
        await startPaymentAuditConsumer();

        const server = app.listen(env.PORT, () => {
            logger.info(`Payment service listening on port ${env.PORT}`);
        });

        const shutdown = async () => {
            logger.info("Shutting down server...");
            server.close(async () => {
                // Stop the retry worker gracefully
                await stopPaymentRetryWorker();
                await stopPaymentAuditConsumer();
                await shutdownPaymentEventBus();
                await closePaymentRetryQueue();
                await closePaymentDlqQueue();

                await pool.end();
                redisClient.disconnect();
                logger.info("Shutdown complete");
                process.exit(0);
            });
        };

        process.on("SIGINT", shutdown);
        process.on("SIGTERM", shutdown);
    } catch (error) {
        logger.error({ err: error }, "Failed to start server");
        process.exit(1);
    }
}

startServer();
