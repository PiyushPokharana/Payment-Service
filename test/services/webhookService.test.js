const crypto = require("crypto");

jest.mock("../../src/config/logger", () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

jest.mock("../../src/config/database", () => ({
    pool: {
        connect: jest.fn()
    }
}));

jest.mock("../../src/models/orderModel", () => ({
    updateOrderStatus: jest.fn()
}));

jest.mock("../../src/models/webhookEventModel", () => ({
    insertWebhookEvent: jest.fn()
}));

jest.mock("../../src/services/paymentLogService", () => ({
    recordPaymentLog: jest.fn()
}));

const { pool } = require("../../src/config/database");
const orderModel = require("../../src/models/orderModel");
const webhookEventModel = require("../../src/models/webhookEventModel");
const { recordPaymentLog } = require("../../src/services/paymentLogService");
const webhookService = require("../../src/services/webhookService");

describe("webhookService", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("verifies webhook signatures with the configured secret", () => {
        const rawBody = Buffer.from(JSON.stringify({ event: "payment.captured" }));
        const signature = crypto
            .createHmac("sha256", process.env.WEBHOOK_SECRET)
            .update(rawBody)
            .digest("hex");

        expect(webhookService.verifyWebhookSignature(rawBody, signature)).toBe(true);
        expect(webhookService.verifyWebhookSignature(rawBody, "bad-signature")).toBe(false);
    });

    it("normalizes nested webhook payloads", () => {
        expect(
            webhookService.normalizeWebhookPayload({
                event_id: "evt_1",
                event: "payment.captured",
                payload: {
                    payment: {
                        entity: {
                            order_id: "123e4567-e89b-12d3-a456-426614174000"
                        }
                    }
                }
            })
        ).toEqual({
            eventId: "evt_1",
            eventType: "payment.captured",
            orderId: "123e4567-e89b-12d3-a456-426614174000",
            status: "paid"
        });
    });

    it("rejects invalid webhook signatures and writes the audit decision", async () => {
        webhookEventModel.insertWebhookEvent.mockResolvedValue({ id: "audit-1" });
        recordPaymentLog.mockResolvedValue({ id: "log-1" });

        const result = await webhookService.processPaymentWebhook({
            rawBody: Buffer.from('{"event":"payment.captured"}'),
            signature: "bad-signature"
        });

        expect(result).toEqual({ status: "invalid_signature" });
        expect(webhookEventModel.insertWebhookEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                decision: "rejected_signature",
                signatureValid: false
            }),
            undefined
        );
        expect(recordPaymentLog).toHaveBeenCalledWith(
            expect.objectContaining({
                eventType: "webhook_decision",
                status: "rejected_signature"
            })
        );
    });

    it("rejects duplicate webhook events", async () => {
        const client = {
            query: jest.fn().mockResolvedValue({}),
            release: jest.fn()
        };
        pool.connect.mockResolvedValue(client);
        webhookEventModel.insertWebhookEvent
            .mockImplementationOnce(async () => {
                const duplicateError = new Error("duplicate key");
                duplicateError.code = "23505";
                throw duplicateError;
            })
            .mockResolvedValueOnce({ id: "audit-dup" });
        orderModel.updateOrderStatus.mockResolvedValue({
            id: "123e4567-e89b-12d3-a456-426614174000",
            status: "paid"
        });
        recordPaymentLog.mockResolvedValue({ id: "log-2" });

        const rawBody = Buffer.from(
            JSON.stringify({
                event_id: "evt_2",
                event: "payment.captured",
                order_id: "123e4567-e89b-12d3-a456-426614174000",
                status: "paid"
            })
        );
        const signature = crypto
            .createHmac("sha256", process.env.WEBHOOK_SECRET)
            .update(rawBody)
            .digest("hex");

        const result = await webhookService.processPaymentWebhook({
            rawBody,
            signature
        });

        expect(result).toEqual({
            status: "duplicate",
            eventId: "evt_2"
        });
        expect(client.query).toHaveBeenCalledWith("BEGIN");
        expect(client.query).toHaveBeenCalledWith("ROLLBACK");
        expect(webhookEventModel.insertWebhookEvent).toHaveBeenCalledTimes(2);
        expect(recordPaymentLog).toHaveBeenCalledWith(
            expect.objectContaining({
                eventType: "webhook_decision",
                status: "rejected_duplicate"
            })
        );
    });
});