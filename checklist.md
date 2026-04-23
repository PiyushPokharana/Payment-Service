# Payment Microservice Implementation Checklist

Use this checklist to track progress phase by phase. Mark each item as done when completed.

---

## Phase 0 - Foundation (Day 1)

### Goal
Set up a real backend microservice.

### Repository and Bootstrap
- [ ] Create repository named `payment-service`.
- [x] Initialize Node.js project (`npm init -y`).
- [ ] Choose framework and scaffold app:
  - [x] Express setup completed.
  - [ ] or Fastify setup completed.
- [x] Add basic health endpoint (`GET /health`).

### Infrastructure Setup
- [x] Provision PostgreSQL (local Docker or managed instance).
- [x] Provision Redis (local Docker or managed instance).
- [x] Add DB connection module and verify startup connection.
- [x] Add Redis connection module and verify startup connection.

### Core Project Setup
- [ ] Add logger:
  - [x] Pino integrated.
  - [ ] or Winston integrated.
- [ ] Add environment configuration:
  - [x] `.env` support added.
  - [x] Required env variables documented.
  - [x] Runtime validation for env variables.
- [x] Add error handling middleware.
- [x] Add request logging middleware.

### Folder Structure
- [ ] Create folders:
  - [x] `src/controllers`
  - [x] `src/services`
  - [x] `src/routes`
  - [x] `src/models`
  - [x] `src/middleware`
  - [x] `src/utils`
  - [x] `src/config`
  - [x] `src/queues`

### Output Criteria
- [x] Server starts successfully.
- [x] PostgreSQL connection verified.
- [x] Redis connection verified.
- [x] Clean modular structure in place.

---

## Phase 1 - Order Creation System (Day 2-3)

### Goal
Simulate payment intent creation.

### API Contract
- [x] Implement `POST /orders`.
- [x] Request body supports:
  - [x] `amount` (e.g., `50000`).
  - [x] `currency` (e.g., `INR`).
- [x] Add request validation:
  - [x] Amount is positive integer.
  - [x] Currency is valid ISO code (or project-defined list).

### Database Work
- [x] Create `orders` table with:
  - [x] `id` (uuid, primary key)
  - [x] `amount`
  - [x] `currency`
  - [x] `status` (`pending`, `paid`, `failed`)
  - [x] `created_at`
- [x] Add DB migration for `orders`.

### Business Logic
- [x] Generate UUID order IDs (no incremental IDs).
- [x] Set default order status to `pending`.
- [x] Save new order in DB.

### Response and Error Cases
- [x] Return clean success response with order details.
- [x] Return proper error responses for invalid payload.
- [x] Log order creation success and failures.

### Output Criteria
- [x] Order gets created.
- [x] Order persisted in DB.
- [x] API response format is clean and consistent.

---

## Phase 2 - Payment Processing Simulation (Day 4-5)

### Goal
Simulate real-world payment processing outcomes.

### API
- [x] Implement `POST /payments/process`.
- [x] Accept required identifiers (e.g., `order_id`, `payment_method`).

### Database Work
- [x] Create `transactions` table with:
  - [x] `id`
  - [x] `order_id` (FK)
  - [x] `status`
  - [x] `payment_method`
  - [x] `attempt_count`
  - [x] `created_at`
- [x] Add FK constraint from `transactions.order_id` to `orders.id`.
- [x] Add migration for `transactions`.

### Processing Logic
- [x] Simulate success flow.
- [x] Simulate failure flow.
- [x] Simulate timeout flow.
- [x] Link transaction to order.
- [x] Update order status based on result.
- [x] Increment attempt count for retries/reattempts.

### Output Criteria
- [x] Payment attempts recorded against orders.
- [x] Order and transaction statuses are updated correctly.

---

## Phase 3 - Webhook System (Day 6-7)

### Goal
Implement secure, interview-grade webhook handling.

### Endpoint
- [x] Implement `POST /webhook/payment`.

### Security and Correctness
- [x] Verify HMAC signature for incoming webhook payload.
- [x] Reject payload if signature validation fails.
- [x] Add replay attack prevention:
  - [x] Store webhook event ID.
  - [x] Reject duplicate webhook event IDs.
- [x] Ensure idempotent webhook processing:
  - [x] Same event does not cause repeated updates.

### Operational Work
- [x] Add webhook processing logs.
- [x] Add audit trace for webhook decisions (accepted/rejected).

### Output Criteria
- [x] Webhook endpoint is secure.
- [x] Duplicate and tampered requests are blocked.

---

## Phase 4 - Idempotency System (Day 8)

### Goal
Prevent duplicate payment operations.

### Request Handling
- [x] Support `Idempotency-Key` request header.
- [x] Validate header presence for protected endpoints.

### Storage and Lookup
- [x] Store idempotency key in Redis or DB with response snapshot.
- [x] On repeated key, return previously stored response.
- [x] Add expiry policy for key records.

### Edge Cases
- [x] Handle in-progress duplicate requests safely.
- [x] Handle key collisions and malformed values.

### Output Criteria
- [x] Duplicate requests with same key are safe and deterministic.

---

## Phase 5 - Retry and Failure Handling (Day 9-10)

### Goal
Handle transient failures with controlled retries.

### Queue Setup
- [x] Integrate BullMQ.
- [x] Configure queue + worker + connection settings.

### Retry Logic
- [x] Push failed payments to retry queue.
- [x] Implement exponential backoff:
  - [x] 1 second
  - [x] 5 seconds
  - [x] 15 seconds
- [x] Set max retry count.
- [x] Mark final state after retries exhausted.

### Observability
- [x] Log each retry attempt.
- [x] Log final failure reason after max retries.

### Output Criteria
- [x] Failure handling is resilient and production-oriented.

---

## Phase 6 - Dead Letter Queue (Day 11)

### Goal
Capture permanent failures without data loss.

### DLQ Implementation
- [x] Add dead-letter queue.
- [x] Route jobs to DLQ after retry exhaustion.
- [x] Store metadata for failed jobs (error, attempts, order_id).

### Recovery Support
- [x] Add mechanism to inspect DLQ jobs.
- [x] Add optional reprocess command/endpoint for DLQ jobs.

### Output Criteria
- [x] Permanent failures are retained and traceable.

---

## Phase 7 - Transaction Logging and Audit (Day 12)

### Goal
Make the system finance-grade and traceable.

### Database Work
- [x] Create `payment_logs` table with:
  - [x] `id`
  - [x] `order_id`
  - [x] `event_type`
  - [x] `status`
  - [x] `timestamp`
- [x] Add migration for `payment_logs`.

### Logging Strategy
- [x] Record key lifecycle events.
- [x] Ensure logs are immutable/audit-friendly.
- [x] Correlate logs with order and transaction IDs.

### Output Criteria
- [x] End-to-end traceability for payment lifecycle.

---

## Phase 8 - Event-Driven Design (Day 13-14)

### Goal
Introduce decoupled communication patterns.

### Event Publishing
- [x] Emit `payment_success` event.
- [x] Emit `payment_failed` event.

### Event Transport
- [x] Implement simple Redis pub-sub or Kafka integration.
- [x] Define event schema/versioning.

### Event Consumers
- [x] Add at least one consumer module (e.g., notifications/audit).
- [x] Ensure consumer idempotency and error handling.

### Output Criteria
- [x] Payment system demonstrates decoupled architecture.

---

## Phase 9 - Testing (Day 15)

### Goal
Prove correctness and reliability.

### Unit Testing
- [x] Add tests for services (orders, payments, webhook, retries).
- [x] Add tests for utility functions (HMAC, idempotency helpers).

### API Testing
- [x] Add integration/API tests with Jest + Supertest.
- [x] Cover happy path and failure path for key endpoints.

### Critical Test Scenarios
- [x] Duplicate webhook event rejected.
- [x] Invalid signature rejected.
- [x] Idempotent request returns same response.
- [x] Retry logic follows configured backoff and limits.

### Output Criteria
- [x] Tests pass consistently.
- [x] Core risk areas are covered.

---

## Phase 10 - Deployment (Day 16-17)

### Goal
Deploy a production-like runnable service.

### Deployment Targets
- [ ] Deploy backend to Railway or Render.
- [ ] Deploy PostgreSQL to cloud provider.
- [ ] Deploy Redis to Upstash or equivalent.

### Packaging and Configuration
- [x] Add `Dockerfile`.
- [x] Add `.env.example` with all required keys.
- [x] Configure startup command and health checks.
- [ ] Configure environment variables in deployment platform.

### Verification
- [ ] Run smoke tests on deployed service.
- [ ] Validate DB + Redis connectivity in production.

---

## Phase 11 - README (Most Important)

### Goal
Turn implementation into an interview-ready showcase.

### Must Include in README
- [x] Payment flow diagram.
- [x] Idempotency explanation.
- [x] Webhook security approach.
- [x] Failure handling strategy.
- [x] Retry mechanism details.

### Recommended README Sections
- [x] Project overview and architecture.
- [x] API endpoints with sample requests/responses.
- [x] Local setup steps.
- [x] Environment variable reference.
- [x] Deployment links and instructions.
- [x] Test instructions.

### Output Criteria
- [x] README clearly communicates engineering depth and design decisions.

---

## Cross-Phase Definition of Done

- [ ] Coding standards and linting configured.
- [ ] Consistent error response format across APIs.
- [ ] Structured logging with correlation IDs.
- [ ] Basic monitoring hooks/metrics considered.
- [ ] All migrations versioned and reproducible.
- [ ] No critical TODOs left in core flows.
