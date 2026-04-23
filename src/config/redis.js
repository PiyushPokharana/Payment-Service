const Redis = require("ioredis");
const logger = require("./logger");
const env = require("./env");

const redisClient = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 3
});

async function verifyRedisConnection() {
    await redisClient.connect();
    await redisClient.ping();
    logger.info("Redis connection verified");
}

module.exports = {
    redisClient,
    verifyRedisConnection
};
