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

module.exports = {
    createOrder
};
