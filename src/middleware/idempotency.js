const crypto = require("crypto");
const logger = require("../config/logger");
const env = require("../config/env");
const { redisClient } = require("../config/redis");

const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
const IDEMPOTENCY_KEY_REGEX = /^[A-Za-z0-9_-]{8,128}$/;

function sleep(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}

function stableStringify(value) {
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(",")}]`;
    }

    if (value && typeof value === "object") {
        const keys = Object.keys(value).sort();
        return `{${keys
            .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
            .join(",")}}`;
    }

    return JSON.stringify(value);
}

function buildRequestFingerprint(req) {
    const method = (req.method || "").toUpperCase();
    const route = req.originalUrl || req.path || "";
    const body = stableStringify(req.body || {});

    return crypto
        .createHash("sha256")
        .update(`${method}:${route}:${body}`)
        .digest("hex");
}

function buildRedisKey(idempotencyKey) {
    return `idempotency:${idempotencyKey}`;
}

function parseRedisSnapshot(rawValue) {
    if (!rawValue) {
        return null;
    }

    try {
        return JSON.parse(rawValue);
    } catch (error) {
        return null;
    }
}

function isFingerprintMismatch(snapshot, fingerprint) {
    return snapshot && snapshot.fingerprint && snapshot.fingerprint !== fingerprint;
}

async function waitForCompletedSnapshot(redisKey, fingerprint) {
    const timeoutAt = Date.now() + env.IDEMPOTENCY_IN_PROGRESS_WAIT_MS;

    while (Date.now() < timeoutAt) {
        await sleep(100);
        const retryRaw = await redisClient.get(redisKey);
        const retrySnapshot = parseRedisSnapshot(retryRaw);

        if (!retrySnapshot) {
            return null;
        }

        if (isFingerprintMismatch(retrySnapshot, fingerprint)) {
            return "mismatch";
        }

        if (retrySnapshot.state === "completed") {
            return retrySnapshot;
        }
    }

    return "processing";
}

function sendCachedResponse(res, snapshot, replayStatus) {
    res.set("Idempotency-Status", replayStatus);
    res.status(snapshot.statusCode);
    return res.json(snapshot.responseBody);
}

function createIdempotencyMiddleware() {
    return async function idempotencyMiddleware(req, res, next) {
        const idempotencyKey = (req.get(IDEMPOTENCY_KEY_HEADER) || "").trim();

        if (!idempotencyKey) {
            return res.status(400).json({
                success: false,
                message: `${IDEMPOTENCY_KEY_HEADER} header is required`
            });
        }

        if (!IDEMPOTENCY_KEY_REGEX.test(idempotencyKey)) {
            return res.status(400).json({
                success: false,
                message: `${IDEMPOTENCY_KEY_HEADER} is malformed`
            });
        }

        const fingerprint = buildRequestFingerprint(req);
        const redisKey = buildRedisKey(idempotencyKey);

        const existingRaw = await redisClient.get(redisKey);
        const existingSnapshot = parseRedisSnapshot(existingRaw);

        if (existingSnapshot) {
            if (isFingerprintMismatch(existingSnapshot, fingerprint)) {
                return res.status(409).json({
                    success: false,
                    message: "Idempotency key was already used with different request data"
                });
            }

            if (existingSnapshot.state === "completed") {
                return sendCachedResponse(res, existingSnapshot, "replayed");
            }

            if (existingSnapshot.state === "processing") {
                const waitResult = await waitForCompletedSnapshot(redisKey, fingerprint);

                if (waitResult === "mismatch") {
                    return res.status(409).json({
                        success: false,
                        message: "Idempotency key was already used with different request data"
                    });
                }

                if (waitResult && waitResult.state === "completed") {
                    return sendCachedResponse(res, waitResult, "replayed-after-wait");
                }

                return res.status(409).json({
                    success: false,
                    message: "A request with the same Idempotency-Key is still in progress"
                });
            }
        }

        const processingSnapshot = {
            state: "processing",
            fingerprint,
            createdAt: new Date().toISOString()
        };

        const lockResult = await redisClient.set(
            redisKey,
            JSON.stringify(processingSnapshot),
            "EX",
            env.IDEMPOTENCY_KEY_TTL_SECONDS,
            "NX"
        );

        if (lockResult !== "OK") {
            const retryRaw = await redisClient.get(redisKey);
            const retrySnapshot = parseRedisSnapshot(retryRaw);

            if (retrySnapshot && isFingerprintMismatch(retrySnapshot, fingerprint)) {
                return res.status(409).json({
                    success: false,
                    message: "Idempotency key was already used with different request data"
                });
            }

            if (retrySnapshot && retrySnapshot.state === "completed") {
                return sendCachedResponse(res, retrySnapshot, "replayed");
            }

            return res.status(409).json({
                success: false,
                message: "A request with the same Idempotency-Key is still in progress"
            });
        }

        res.set("Idempotency-Status", "created");

        let responseBody;
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            responseBody = body;
            return originalJson(body);
        };

        res.on("finish", async () => {
            try {
                if (res.statusCode >= 500) {
                    await redisClient.del(redisKey);
                    return;
                }

                const completedSnapshot = {
                    state: "completed",
                    fingerprint,
                    statusCode: res.statusCode,
                    responseBody,
                    completedAt: new Date().toISOString()
                };

                await redisClient.set(
                    redisKey,
                    JSON.stringify(completedSnapshot),
                    "EX",
                    env.IDEMPOTENCY_KEY_TTL_SECONDS
                );
            } catch (error) {
                logger.error(
                    {
                        err: error,
                        idempotencyKey
                    },
                    "Failed to persist idempotency snapshot"
                );
            }
        });

        return next();
    };
}

module.exports = createIdempotencyMiddleware;