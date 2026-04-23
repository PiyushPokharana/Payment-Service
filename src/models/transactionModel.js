const { pool } = require("../config/database");

async function getNextAttemptCount(orderId, paymentMethod) {
    const query = `
        SELECT MAX(attempt_count) AS latest_attempt
        FROM transactions
        WHERE order_id = $1 AND payment_method = $2
    `;

    const result = await pool.query(query, [orderId, paymentMethod]);
    const latestAttempt = Number(result.rows[0]?.latest_attempt || 0);

    return latestAttempt + 1;
}

async function createTransaction(transaction) {
    const query = `
        INSERT INTO transactions (id, order_id, status, payment_method, attempt_count)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, order_id, status, payment_method, attempt_count, created_at
    `;

    const values = [
        transaction.id,
        transaction.orderId,
        transaction.status,
        transaction.paymentMethod,
        transaction.attemptCount
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
}

async function getTransactionsByOrderId(orderId) {
    const query = `
        SELECT id, order_id, status, payment_method, attempt_count, created_at
        FROM transactions
        WHERE order_id = $1
        ORDER BY created_at DESC
    `;

    const result = await pool.query(query, [orderId]);
    return result.rows;
}

async function listTransactions(limit = 100) {
    const query = `
        SELECT t.id, t.order_id, t.status, t.payment_method, t.attempt_count, t.created_at,
               o.amount, o.currency
        FROM transactions t
        JOIN orders o ON o.id = t.order_id
        ORDER BY t.created_at DESC
        LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows;
}

module.exports = {
    getNextAttemptCount,
    createTransaction,
    getTransactionsByOrderId,
    listTransactions
};
