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
- [ ] Implement `POST /orders`.
- [ ] Request body supports:
  - [ ] `amount` (e.g., `50000`).
  - [ ] `currency` (e.g., `INR`).
- [ ] Add request validation:
  - [ ] Amount is positive integer.
  - [ ] Currency is valid ISO code (or project-defined list).

### Database Work
- [ ] Create `orders` table with:
  - [ ] `id` (uuid, primary key)
  - [ ] `amount`
  - [ ] `currency`
  - [ ] `status` (`pending`, `paid`, `failed`)
  - [ ] `created_at`
- [ ] Add DB migration for `orders`.

### Business Logic
- [ ] Generate UUID order IDs (no incremental IDs).
- [ ] Set default order status to `pending`.
- [ ] Save new order in DB.

### Response and Error Cases
- [ ] Return clean success response with order details.
- [ ] Return proper error responses for invalid payload.
- [ ] Log order creation success and failures.

### Output Criteria
- [ ] Order gets created.
- [ ] Order persisted in DB.
- [ ] API response format is clean and consistent.

---

## Phase 2 - Payment Processing Simulation (Day 4-5)

### Goal
Simulate real-world payment processing outcomes.

### API
- [ ] Implement `POST /payments/process`.
- [ ] Accept required identifiers (e.g., `order_id`, `payment_method`).

### Database Work
- [ ] Create `transactions` table with:
  - [ ] `id`
  - [ ] `order_id` (FK)
  - [ ] `status`
  - [ ] `payment_method`
  - [ ] `attempt_count`
  - [ ] `created_at`
- [ ] Add FK constraint from `transactions.order_id` to `orders.id`.
- [ ] Add migration for `transactions`.

### Processing Logic
- [ ] Simulate success flow.
- [ ] Simulate failure flow.
- [ ] Simulate timeout flow.
- [ ] Link transaction to order.
- [ ] Update order status based on result.
- [ ] Increment attempt count for retries/reattempts.

### Output Criteria
- [ ] Payment attempts recorded against orders.
- [ ] Order and transaction statuses are updated correctly.

---

## Phase 3 - Webhook System (Day 6-7)

### Goal
Implement secure, interview-grade webhook handling.

### Endpoint
- [ ] Implement `POST /webhook/payment`.

### Security and Correctness
- [ ] Verify HMAC signature for incoming webhook payload.
- [ ] Reject payload if signature validation fails.
- [ ] Add replay attack prevention:
  - [ ] Store webhook event ID.
  - [ ] Reject duplicate webhook event IDs.
- [ ] Ensure idempotent webhook processing:
  - [ ] Same event does not cause repeated updates.

### Operational Work
- [ ] Add webhook processing logs.
- [ ] Add audit trace for webhook decisions (accepted/rejected).

### Output Criteria
- [ ] Webhook endpoint is secure.
- [ ] Duplicate and tampered requests are blocked.

---

## Phase 4 - Idempotency System (Day 8)

### Goal
Prevent duplicate payment operations.

### Request Handling
- [ ] Support `Idempotency-Key` request header.
- [ ] Validate header presence for protected endpoints.

### Storage and Lookup
- [ ] Store idempotency key in Redis or DB with response snapshot.
- [ ] On repeated key, return previously stored response.
- [ ] Add expiry policy for key records.

### Edge Cases
- [ ] Handle in-progress duplicate requests safely.
- [ ] Handle key collisions and malformed values.

### Output Criteria
- [ ] Duplicate requests with same key are safe and deterministic.

---

## Phase 5 - Retry and Failure Handling (Day 9-10)

### Goal
Handle transient failures with controlled retries.

### Queue Setup
- [ ] Integrate BullMQ.
- [ ] Configure queue + worker + connection settings.

### Retry Logic
- [ ] Push failed payments to retry queue.
- [ ] Implement exponential backoff:
  - [ ] 1 second
  - [ ] 5 seconds
  - [ ] 15 seconds
- [ ] Set max retry count.
- [ ] Mark final state after retries exhausted.

### Observability
- [ ] Log each retry attempt.
- [ ] Log final failure reason after max retries.

### Output Criteria
- [ ] Failure handling is resilient and production-oriented.

---

## Phase 6 - Dead Letter Queue (Day 11)

### Goal
Capture permanent failures without data loss.

### DLQ Implementation
- [ ] Add dead-letter queue.
- [ ] Route jobs to DLQ after retry exhaustion.
- [ ] Store metadata for failed jobs (error, attempts, order_id).

### Recovery Support
- [ ] Add mechanism to inspect DLQ jobs.
- [ ] Add optional reprocess command/endpoint for DLQ jobs.

### Output Criteria
- [ ] Permanent failures are retained and traceable.

---

## Phase 7 - Transaction Logging and Audit (Day 12)

### Goal
Make the system finance-grade and traceable.

### Database Work
- [ ] Create `payment_logs` table with:
  - [ ] `id`
  - [ ] `order_id`
  - [ ] `event_type`
  - [ ] `status`
  - [ ] `timestamp`
- [ ] Add migration for `payment_logs`.

### Logging Strategy
- [ ] Record key lifecycle events.
- [ ] Ensure logs are immutable/audit-friendly.
- [ ] Correlate logs with order and transaction IDs.

### Output Criteria
- [ ] End-to-end traceability for payment lifecycle.

---

## Phase 8 - Event-Driven Design (Day 13-14)

### Goal
Introduce decoupled communication patterns.

### Event Publishing
- [ ] Emit `payment_success` event.
- [ ] Emit `payment_failed` event.

### Event Transport
- [ ] Implement simple Redis pub-sub or Kafka integration.
- [ ] Define event schema/versioning.

### Event Consumers
- [ ] Add at least one consumer module (e.g., notifications/audit).
- [ ] Ensure consumer idempotency and error handling.

### Output Criteria
- [ ] Payment system demonstrates decoupled architecture.

---

## Phase 9 - Testing (Day 15)

### Goal
Prove correctness and reliability.

### Unit Testing
- [ ] Add tests for services (orders, payments, webhook, retries).
- [ ] Add tests for utility functions (HMAC, idempotency helpers).

### API Testing
- [ ] Add integration/API tests with Jest + Supertest.
- [ ] Cover happy path and failure path for key endpoints.

### Critical Test Scenarios
- [ ] Duplicate webhook event rejected.
- [ ] Invalid signature rejected.
- [ ] Idempotent request returns same response.
- [ ] Retry logic follows configured backoff and limits.

### Output Criteria
- [ ] Tests pass consistently.
- [ ] Core risk areas are covered.

---

## Phase 10 - Deployment (Day 16-17)

### Goal
Deploy a production-like runnable service.

### Deployment Targets
- [ ] Deploy backend to Railway or Render.
- [ ] Deploy PostgreSQL to cloud provider.
- [ ] Deploy Redis to Upstash or equivalent.

### Packaging and Configuration
- [ ] Add `Dockerfile`.
- [ ] Add `.env.example` with all required keys.
- [ ] Configure startup command and health checks.
- [ ] Configure environment variables in deployment platform.

### Verification
- [ ] Run smoke tests on deployed service.
- [ ] Validate DB + Redis connectivity in production.

---

## Phase 11 - README (Most Important)

### Goal
Turn implementation into an interview-ready showcase.

### Must Include in README
- [ ] Payment flow diagram.
- [ ] Idempotency explanation.
- [ ] Webhook security approach.
- [ ] Failure handling strategy.
- [ ] Retry mechanism details.

### Recommended README Sections
- [ ] Project overview and architecture.
- [ ] API endpoints with sample requests/responses.
- [ ] Local setup steps.
- [ ] Environment variable reference.
- [ ] Deployment links and instructions.
- [ ] Test instructions.

### Output Criteria
- [ ] README clearly communicates engineering depth and design decisions.

---

## Cross-Phase Definition of Done

- [ ] Coding standards and linting configured.
- [ ] Consistent error response format across APIs.
- [ ] Structured logging with correlation IDs.
- [ ] Basic monitoring hooks/metrics considered.
- [ ] All migrations versioned and reproducible.
- [ ] No critical TODOs left in core flows.
