const { z } = require("zod");

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    WEBHOOK_SECRET: z.string().min(1, "WEBHOOK_SECRET is required"),
    IDEMPOTENCY_KEY_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
    IDEMPOTENCY_IN_PROGRESS_WAIT_MS: z.coerce.number().int().positive().default(5000),
    PAYMENT_RETRY_QUEUE_NAME: z.string().min(1).default("payment-retries"),
    PAYMENT_RETRY_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
    PAYMENT_RETRY_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
    ENABLE_STARTUP_CONNECTION_CHECKS: z
        .string()
        .optional()
        .default("true")
        .transform((value) => value.toLowerCase() === "true")
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    const issues = parsedEnv.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");

    throw new Error(`Invalid environment configuration: ${issues}`);
}

module.exports = parsedEnv.data;
