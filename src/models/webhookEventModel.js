const { pool } = require("../config/database");

async function insertWebhookEvent(entry, client = pool) {
    const query = `
        INSERT INTO webhook_events (
            id,
            event_id,
            event_type,
            order_id,
            decision,
            reason,
            signature_valid,
            payload
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, event_id, event_type, order_id, decision, reason, signature_valid, created_at
    `;

    const values = [
        entry.id,
        entry.eventId || null,
        entry.eventType || null,
        entry.orderId || null,
        entry.decision,
        entry.reason || null,
        entry.signatureValid,
        entry.payload || null
    ];

    const result = await client.query(query, values);
    return result.rows[0];
}

module.exports = {
    insertWebhookEvent
};
