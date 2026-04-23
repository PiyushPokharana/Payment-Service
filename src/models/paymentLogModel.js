const { pool } = require("../config/database");

async function insertPaymentLog(entry, client = pool) {
    const query = `
        INSERT INTO payment_logs (
            id,
            order_id,
            transaction_id,
            event_type,
            status,
            metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, order_id, transaction_id, event_type, status, timestamp
    `;

    const values = [
        entry.id,
        entry.orderId || null,
        entry.transactionId || null,
        entry.eventType,
        entry.status,
        entry.metadata || {}
    ];

    const result = await client.query(query, values);
    return result.rows[0];
}

module.exports = {
    insertPaymentLog
};