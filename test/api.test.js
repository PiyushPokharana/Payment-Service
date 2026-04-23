const request = require("supertest");

const mockRedisState = new Map();

jest.mock("../src/config/logger", () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

jest.mock("../src/config/redis", () => ({
    redisClient: {
        get: jest.fn(async (key) => mockRedisState.get(key) || null),
        set: jest.fn(async (key, value, mode, ttl, nx) => {
            if (nx === "NX" && mockRedisState.has(key)) {
                return null;
            }

            mockRedisState.set(key, value);
            return "OK";
        }),
        del: jest.fn(async (key) => {
            mockRedisState.delete(key);
            return 1;
        })
    }
}));

jest.mock("../src/services/orderService", () => ({
    validateCreateOrderPayload: jest.fn(),
    createOrder: jest.fn()
}));

jest.mock("../src/services/paymentService", () => ({
    validateProcessPaymentPayload: jest.fn(),
    processPayment: jest.fn()
}));

jest.mock("../src/services/webhookService", () => ({
    processPaymentWebhook: jest.fn()
}));

jest.mock("../src/middleware/requestLogger", () => {
    return jest.fn((req, res, next) => next());
});

const orderService = require("../src/services/orderService");
const paymentService = require("../src/services/paymentService");
const webhookService = require("../src/services/webhookService");
const app = require("../src/app");

function flushAsyncWork() {
    return new Promise((resolve) => setImmediate(resolve));
}

describe("HTTP API", () => {
    beforeEach(() => {
        mockRedisState.clear();
        jest.clearAllMocks();

        orderService.validateCreateOrderPayload.mockImplementation((payload) => ({
            success: true,
            data: payload
        }));
        paymentService.validateProcessPaymentPayload.mockImplementation((payload) => ({
            success: true,
            data: payload
        }));
    });

    it("replays the same response for a repeated idempotent order request", async () => {
        orderService.createOrder.mockResolvedValue({
            id: "order-1",
            amount: 50000,
            currency: "INR",
            status: "pending"
        });

        const payload = { amount: 50000, currency: "INR" };

        const firstResponse = await request(app)
            .post("/orders")
            .set("Idempotency-Key", "orderkey1")
            .send(payload);

        await flushAsyncWork();

        const secondResponse = await request(app)
            .post("/orders")
            .set("Idempotency-Key", "orderkey1")
            .send(payload);

        expect(firstResponse.status).toBe(201);
        expect(firstResponse.headers["idempotency-status"]).toBe("created");
        expect(secondResponse.status).toBe(201);
        expect(secondResponse.headers["idempotency-status"]).toBe("replayed");
        expect(secondResponse.body).toEqual(firstResponse.body);
        expect(orderService.createOrder).toHaveBeenCalledTimes(1);
    });

    it("returns a successful payment response from the payments API", async () => {
        paymentService.processPayment.mockResolvedValue({
            simulation_outcome: "success",
            transaction: {
                id: "txn-1",
                status: "success"
            },
            order: {
                id: "order-2",
                status: "paid"
            },
            queued_for_retry: false
        });

        const response = await request(app)
            .post("/payments/process")
            .set("Idempotency-Key", "paymentkey1")
            .send({
                order_id: "order-2",
                payment_method: "card",
                simulation_outcome: "success"
            });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            success: true,
            message: "Payment processed",
            data: {
                simulation_outcome: "success",
                transaction: {
                    id: "txn-1"
                },
                order: {
                    id: "order-2",
                    status: "paid"
                }
            }
        });
        expect(paymentService.processPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                order_id: "order-2",
                payment_method: "card"
            })
        );
    });

    it("returns a 401 from the webhook API when the webhook service rejects the signature", async () => {
        webhookService.processPaymentWebhook.mockResolvedValue({
            status: "invalid_signature"
        });

        const response = await request(app)
            .post("/webhook/payment")
            .set("x-razorpay-signature", "bad-signature")
            .set("Content-Type", "application/json")
            .send(Buffer.from(JSON.stringify({ event: "payment.captured" })));

        expect(response.status).toBe(401);
        expect(response.body).toEqual({
            success: false,
            message: "Invalid webhook signature"
        });
        expect(webhookService.processPaymentWebhook).toHaveBeenCalledWith(
            expect.objectContaining({
                signature: "bad-signature"
            })
        );
    });
});