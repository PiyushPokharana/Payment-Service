const { randomUUID } = require("crypto");
const logger = require("../config/logger");
const paymentLogModel = require("../models/paymentLogModel");

async function recordPaymentLog(entry, client) {
    if (!entry?.eventType || !entry?.status) {
        throw new Error("eventType and status are required for payment logs");
    }

    return paymentLogModel.insertPaymentLog(
        {
            id: randomUUID(),
            orderId: entry.orderId,
            transactionId: entry.transactionId,
            eventType: entry.eventType,
            status: entry.status,
            metadata: entry.metadata || {}
        },
        client
    );
}

async function safeRecordPaymentLog(entry, client) {
    try {
        return await recordPaymentLog(entry, client);
    } catch (error) {
        logger.error(
            {
                err: error,
                orderId: entry?.orderId,
                transactionId: entry?.transactionId,
                eventType: entry?.eventType,
                status: entry?.status
            },
            "Failed to persist payment audit log"
        );

        return null;
    }
}

module.exports = {
    recordPaymentLog,
    safeRecordPaymentLog
};