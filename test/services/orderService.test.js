jest.mock("../../src/config/logger", () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

jest.mock("../../src/models/orderModel", () => ({
    createOrder: jest.fn()
}));

jest.mock("../../src/services/paymentLogService", () => ({
    recordPaymentLog: jest.fn()
}));

const orderModel = require("../../src/models/orderModel");
const { recordPaymentLog } = require("../../src/services/paymentLogService");
const orderService = require("../../src/services/orderService");

describe("orderService", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("validates supported order payloads", () => {
        expect(orderService.validateCreateOrderPayload({ amount: 50000, currency: "inr" }).success).toBe(true);
        expect(orderService.validateCreateOrderPayload({ amount: 0, currency: "INR" }).success).toBe(false);
    });

    it("creates an order and records the audit trail", async () => {
        const createdOrder = {
            id: "order-1",
            amount: 50000,
            currency: "INR",
            status: "pending",
            created_at: "2026-04-23T00:00:00.000Z"
        };

        orderModel.createOrder.mockResolvedValue(createdOrder);
        recordPaymentLog.mockResolvedValue({ id: "log-1" });

        const result = await orderService.createOrder({
            amount: 50000,
            currency: "INR"
        });

        expect(orderModel.createOrder).toHaveBeenCalledWith(
            expect.objectContaining({
                id: expect.any(String),
                amount: 50000,
                currency: "INR",
                status: "pending"
            })
        );
        expect(recordPaymentLog).toHaveBeenCalledWith({
            orderId: "order-1",
            eventType: "order_created",
            status: "pending",
            metadata: {
                amount: 50000,
                currency: "INR"
            }
        });
        expect(result).toEqual(createdOrder);
    });
});