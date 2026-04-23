jest.mock("../../src/config/logger", () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

jest.mock("bullmq", () => {
    const queueAdd = jest.fn();
    const queueOn = jest.fn();
    const workerOn = jest.fn();
    const workerClose = jest.fn();
    const queueInstance = {
        add: queueAdd,
        on: queueOn
    };
    const workerInstance = {
        on: workerOn,
        close: workerClose
    };

    return {
        Queue: jest.fn(() => queueInstance),
        Worker: jest.fn((queueName, processor, options) => {
            workerInstance.queueName = queueName;
            workerInstance.processor = processor;
            workerInstance.options = options;
            return workerInstance;
        }),
        __queueAdd: queueAdd,
        __queueInstance: queueInstance,
        __workerInstance: workerInstance
    };
});

jest.mock("../../src/config/env", () => ({
    PAYMENT_RETRY_QUEUE_NAME: "payment-retries",
    PAYMENT_RETRY_MAX_ATTEMPTS: 3,
    PAYMENT_RETRY_WORKER_CONCURRENCY: 2,
    REDIS_URL: "redis://localhost:6379"
}));

jest.mock("../../src/config/redis", () => ({
    redisClient: {}
}));

jest.mock("../../src/services/paymentService", () => ({
    processPayment: jest.fn()
}));

jest.mock("../../src/models/orderModel", () => ({
    updateOrderStatus: jest.fn()
}));

jest.mock("../../src/queues/paymentDlqQueue", () => ({
    addPaymentToDlq: jest.fn()
}));

jest.mock("../../src/services/paymentLogService", () => ({
    safeRecordPaymentLog: jest.fn()
}));

jest.mock("../../src/services/paymentEventBusService", () => ({
    paymentEventTypes: {
        SUCCESS: "payment_success",
        FAILED: "payment_failed"
    },
    publishPaymentEvent: jest.fn()
}));

const bullmq = require("bullmq");
const { __queueAdd, __workerInstance } = bullmq;
const paymentRetryQueue = require("../../src/queues/paymentRetryQueue");
const { createPaymentRetryWorker } = require("../../src/queues/paymentRetryWorker");

describe("retry infrastructure", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("enqueues retry jobs with the configured limits and custom backoff type", async () => {
        __queueAdd.mockResolvedValue({ id: "job-1" });

        await paymentRetryQueue.enqueuePaymentRetry("order-1", "card", "failure");

        expect(__queueAdd).toHaveBeenCalledWith(
            "process-payment-retry",
            {
                orderId: "order-1",
                paymentMethod: "card",
                simulationOutcome: "failure"
            },
            {
                attempts: 3,
                backoff: {
                    type: "custom"
                },
                removeOnComplete: true,
                removeOnFail: false
            }
        );
    });

    it("applies the expected custom backoff delays for retry attempts", () => {
        createPaymentRetryWorker();

        expect(__workerInstance.queueName).toBe("payment-retries");
        expect(__workerInstance.options.concurrency).toBe(2);
        expect(__workerInstance.options.settings.backoffStrategy(1, "custom")).toBe(1000);
        expect(__workerInstance.options.settings.backoffStrategy(2, "custom")).toBe(5000);
        expect(__workerInstance.options.settings.backoffStrategy(3, "custom")).toBe(15000);
        expect(__workerInstance.options.settings.backoffStrategy(9, "custom")).toBe(15000);
        expect(__workerInstance.options.settings.backoffStrategy(1, "fixed")).toBe(0);
    });
});