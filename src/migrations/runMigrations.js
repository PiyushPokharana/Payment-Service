require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");
const logger = require("../config/logger");
const { pool } = require("../config/database");

async function ensureMigrationsTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            migration_name TEXT UNIQUE NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
}

async function getAppliedMigrations() {
    const result = await pool.query("SELECT migration_name FROM schema_migrations");
    return new Set(result.rows.map((row) => row.migration_name));
}

async function applyMigration(fileName, sql) {
    await pool.query("BEGIN");

    try {
        await pool.query(sql);
        await pool.query(
            "INSERT INTO schema_migrations (migration_name) VALUES ($1)",
            [fileName]
        );
        await pool.query("COMMIT");
    } catch (error) {
        await pool.query("ROLLBACK");
        throw error;
    }
}

async function runMigrations() {
    const migrationsDir = path.join(__dirname);
    const files = (await fs.readdir(migrationsDir))
        .filter((file) => file.endsWith(".sql"))
        .sort();

    if (files.length === 0) {
        logger.info("No SQL migration files found");
        return;
    }

    await ensureMigrationsTable();
    const applied = await getAppliedMigrations();

    for (const fileName of files) {
        if (applied.has(fileName)) {
            logger.info({ migration: fileName }, "Skipping already applied migration");
            continue;
        }

        const fullPath = path.join(migrationsDir, fileName);
        const sql = await fs.readFile(fullPath, "utf8");

        logger.info({ migration: fileName }, "Applying migration");
        await applyMigration(fileName, sql);
        logger.info({ migration: fileName }, "Migration applied");
    }
}

runMigrations()
    .then(async () => {
        logger.info("All migrations completed successfully");
        await pool.end();
        process.exit(0);
    })
    .catch(async (error) => {
        logger.error({ err: error }, "Migration run failed");
        await pool.end();
        process.exit(1);
    });
