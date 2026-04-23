const { Pool } = require("pg");
const logger = require("./logger");
const env = require("./env");

const pool = new Pool({
    connectionString: env.DATABASE_URL
});

async function verifyPostgresConnection() {
    await pool.query("SELECT 1");
    logger.info("PostgreSQL connection verified");
}

module.exports = {
    pool,
    verifyPostgresConnection
};
