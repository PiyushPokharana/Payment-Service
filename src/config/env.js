const { z } = require("zod");

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
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
