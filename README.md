# Razorpay Payment Integration

Backend payment microservice scaffold built with Node.js and Express.

## Features (Current)

- Express server with modular structure under `src/`
- Health check endpoint: `GET /health`
- PostgreSQL connectivity setup
- Redis connectivity setup
- Environment variable validation using Zod
- Structured logging with Pino
- Centralized request logging and error handling middleware
- Idempotency protection for write endpoints using `Idempotency-Key`

## Project Structure

```text
src/
  app.js
  server.js
  config/
    database.js
    env.js
    logger.js
    redis.js
  middleware/
    errorHandler.js
    requestLogger.js
  routes/
    health.js
  controllers/
  services/
  models/
  queues/
  utils/
```

## Prerequisites

- Node.js 18+
- Docker Desktop (for local PostgreSQL and Redis)

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Copy and configure environment variables:

```bash
cp .env.example .env
```

3. Start local infrastructure:

```bash
docker compose up -d
```

4. Run the service:

```bash
npm run dev
```

5. Verify health endpoint:

```bash
curl http://localhost:3000/health
```

## Environment Variables

The `.env.example` file contains required variables:

- `NODE_ENV`
- `PORT`
- `LOG_LEVEL`
- `DATABASE_URL`
- `REDIS_URL`
- `WEBHOOK_SECRET`
- `IDEMPOTENCY_KEY_TTL_SECONDS`
- `IDEMPOTENCY_IN_PROGRESS_WAIT_MS`
- `ENABLE_STARTUP_CONNECTION_CHECKS`

## Webhook Endpoint

- `POST /webhook/payment`
- Expects `x-razorpay-signature` header (`sha256` HMAC over raw request body).
- Signature failures are rejected.
- Duplicate webhook `event_id`/`id` values are rejected.
- Valid webhook updates the target order status and records an audit trail in `webhook_events`.

## Idempotency

- Protected endpoints require `Idempotency-Key` header:
  - `POST /orders`
  - `POST /payments/process`
- Repeating the same key with the same request body returns the original stored response.
- Reusing the same key with different request data returns a collision error.
- In-flight duplicate requests are handled safely and return deterministic responses.
- Idempotency records are stored in Redis with configurable expiry.

## Available Scripts

- `npm start` - start server
- `npm run dev` - start with nodemon
- `npm test` - placeholder test command

## Notes

- `.env` is intentionally gitignored to avoid leaking secrets.
- Startup checks verify DB and Redis connectivity before serving requests.
