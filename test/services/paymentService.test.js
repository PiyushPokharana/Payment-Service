jest.mock("../../src/config/logger", () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

jest.mock("../../src/models/orderModel", () => ({
    getOrderById: jest.fn(),
    updateOrderStatus: jest.fn()
}));

jest.mock("../../src/models/transactionModel", () => ({
    getNextAttemptCount: jest.fn(),
    createTransaction: jest.fn()
}));

jest.mock("../../src/services/paymentLogService", () => ({
    recordPaymentLog: jest.fn(),
    safeRecordPaymentLog: jest.fn()
}));

jest.mock("../../src/services/paymentEventBusService", () => ({
    paymentEventTypes: {
        SUCCESS: "payment_success",
        FAILED: "payment_failed"
    },
    publishPaymentEvent: jest.fn()
}));

jest.mock("../../src/services/paymentRetryService", () => ({
    enqueuePaymentRetry: jest.fn()
}));

const orderModel = require("../../src/models/orderModel");
const transactionModel = require("../../src/models/transactionModel");
const { recordPaymentLog, safeRecordPaymentLog } = require("../../src/services/paymentLogService");
const { publishPaymentEvent } = require("../../src/services/paymentEventBusService");
const { enqueuePaymentRetry } = require("../../src/services/paymentRetryService");
const paymentService = require("../../src/services/paymentService");

describe("paymentService", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("validates payment payloads", () => {
        expect(
            paymentService.validateProcessPaymentPayload({
                order_id: "123e4567-e89b-12d3-a456-426614174000",
                payment_method: "card",
                simulation_outcome: "success"
            }).success
        ).toBe(true);

        expect(
            paymentService.validateProcessPaymentPayload({
                order_id: "not-a-uuid",
                payment_method: "card"
            }).success
        ).toBe(false);
    });

    it("processes a successful payment and publishes the success event", async () => {
        orderModel.getOrderById.mockResolvedValue({
            id: "order-1",
            amount: 50000,
            currency: "INR",
            status: "pending"
        });
        transactionModel.getNextAttemptCount.mockResolvedValue(1);
        transactionModel.createTransaction.mockResolvedValue({
            id: "txn-1",
            order_id: "order-1",
            status: "success",
            payment_method: "card",
            attempt_count: 1,
            created_at: "2026-04-23T00:00:00.000Z"
        });
        orderModel.updateOrderStatus.mockResolvedValue({
            id: "order-1",
            amount: 50000,
            currency: "INR",
            status: "paid"
        });
        recordPaymentLog.mockResolvedValue({ id: "log-1" });
        publishPaymentEvent.mockResolvedValue({ id: "event-1" });

        const result = await paymentService.processPayment({
            order_id: "order-1",
            payment_method: "card",
            simulation_outcome: "success"
        });

        expect(transactionModel.createTransaction).toHaveBeenCalledWith(
            expect.objectContaining({
                orderId: "order-1",
                paymentMethod: "card",
                attemptCount: 1,
                status: "success"
            })
        );
        expect(publishPaymentEvent).toHaveBeenCalledWith(
            "payment_success",
            expect.objectContaining({
                orderId: "order-1",
                transactionId: "txn-1",
                paymentMethod: "card"
            }),
            "payment-service"
        );
        expect(enqueuePaymentRetry).not.toHaveBeenCalled();
        expect(result).toMatchObject({
            simulation_outcome: "success",
            queued_for_retry: false,
            transaction: {
                id: "txn-1",
                status: "success"
            },
            order: {
                id: "order-1",
                status: "paid"
            }
        });
    });

    it("queues a retry for failure outcomes", async () => {
        orderModel.getOrderById.mockResolvedValue({
            id: "order-2",
            amount: 25000,
            currency: "INR",
            status: "pending"
        });
        transactionModel.getNextAttemptCount.mockResolvedValue(2);
        transactionModel.createTransaction.mockResolvedValue({
            id: "txn-2",
            order_id: "order-2",
            status: "failed",
            payment_method: "upi",
            attempt_count: 2,
            created_at: "2026-04-23T00:00:00.000Z"
        });
        orderModel.updateOrderStatus.mockResolvedValue({
            id: "order-2",
            amount: 25000,
            currency: "INR",
            status: "failed"
        });
        recordPaymentLog.mockResolvedValue({ id: "log-2" });
        safeRecordPaymentLog.mockResolvedValue({ id: "log-3" });
        enqueuePaymentRetry.mockResolvedValue({ id: "retry-1" });

        const result = await paymentService.processPayment(
            {
                order_id: "order-2",
                payment_method: "upi",
                simulation_outcome: "failure"
            },
            { shouldEnqueueRetry: true }
        );

        expect(enqueuePaymentRetry).toHaveBeenCalledWith("order-2", "upi", "failure");
        expect(safeRecordPaymentLog).toHaveBeenCalledWith(
            expect.objectContaining({
                orderId: "order-2",
                eventType: "payment_retry_enqueued",
                status: "queued"
            })
        );
        expect(result).toMatchObject({
            simulation_outcome: "failure",
            queued_for_retry: true,
            transaction: {
                id: "txn-2",
                status: "failed"
            },
            order: {
                id: "order-2",
                status: "failed"
            }
        });
        expect(publishPaymentEvent).not.toHaveBeenCalled();
    });
});