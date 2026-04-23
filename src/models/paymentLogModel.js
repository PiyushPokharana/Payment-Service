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

async function getLogsByOrderId(orderId) {
    const query = `
        SELECT id, order_id, transaction_id, event_type, status, timestamp, metadata
        FROM payment_logs
        WHERE order_id = $1
        ORDER BY timestamp DESC
    `;

    const result = await pool.query(query, [orderId]);
    return result.rows;
}

async function listLogs(limit = 200) {
    const query = `
        SELECT id, order_id, transaction_id, event_type, status, timestamp, metadata
        FROM payment_logs
        ORDER BY timestamp DESC
        LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows;
}

module.exports = {
    insertPaymentLog,
    getLogsByOrderId,
    listLogs
};