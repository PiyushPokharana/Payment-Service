const logger = require("../config/logger");
const { enqueuePaymentRetry: queueEnqueue } = require("../queues/paymentRetryQueue");

async function enqueuePaymentRetry(orderId, paymentMethod, simulationOutcome) {
    try {
        const job = await queueEnqueue(orderId, paymentMethod, simulationOutcome);
        return job;
    } catch (error) {
        logger.error(
            {
                err: error,
                orderId,
                paymentMethod,
                simulationOutcome
            },
            "Failed to enqueue payment retry"
        );
        throw error;
    }
}

module.exports = {
    enqueuePaymentRetry
};
