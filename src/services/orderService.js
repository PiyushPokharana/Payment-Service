const { randomUUID } = require("crypto");
const { z } = require("zod");
const logger = require("../config/logger");
const orderModel = require("../models/orderModel");

const supportedCurrencies = new Set(["INR", "USD", "EUR"]);

const createOrderSchema = z.object({
    amount: z
        .number({
            invalid_type_error: "Amount must be a number"
        })
        .int("Amount must be an integer")
        .positive("Amount must be a positive integer"),
    currency: z
        .string({
            invalid_type_error: "Currency must be a string"
        })
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{3}$/, "Currency must be a valid ISO-style 3-letter code")
        .refine(
            (value) => supportedCurrencies.has(value),
            "Currency is not supported"
        )
});

function validateCreateOrderPayload(payload) {
    return createOrderSchema.safeParse(payload);
}

async function createOrder(payload) {
    const orderToCreate = {
        id: randomUUID(),
        amount: payload.amount,
        currency: payload.currency,
        status: "pending"
    };

    const createdOrder = await orderModel.createOrder(orderToCreate);

    logger.info(
        {
            orderId: createdOrder.id,
            amount: createdOrder.amount,
            currency: createdOrder.currency,
            status: createdOrder.status
        },
        "Order created successfully"
    );

    return createdOrder;
}

module.exports = {
    createOrder,
    validateCreateOrderPayload,
    supportedCurrencies
};
