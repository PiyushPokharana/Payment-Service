const { pool } = require("../config/database");

async function createOrder(order) {
    const query = `
        INSERT INTO orders (id, amount, currency, status)
        VALUES ($1, $2, $3, $4)
        RETURNING id, amount, currency, status, created_at
    `;

    const values = [order.id, order.amount, order.currency, order.status];
    const result = await pool.query(query, values);
    return result.rows[0];
}

async function getOrderById(orderId) {
    const query = `
        SELECT id, amount, currency, status, created_at
        FROM orders
        WHERE id = $1
        LIMIT 1
    `;

    const result = await pool.query(query, [orderId]);
    return result.rows[0] || null;
}

async function updateOrderStatus(orderId, status) {
    const query = `
        UPDATE orders
        SET status = $2
        WHERE id = $1
        RETURNING id, amount, currency, status, created_at
    `;

    const result = await pool.query(query, [orderId, status]);
    return result.rows[0] || null;
}

async function listOrders(limit = 100) {
    const query = `
        SELECT id, amount, currency, status, created_at
        FROM orders
        ORDER BY created_at DESC
        LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows;
}

module.exports = {
    createOrder,
    getOrderById,
    updateOrderStatus,
    listOrders
};
