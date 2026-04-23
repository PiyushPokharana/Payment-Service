const express = require("express");
const orderModel = require("../models/orderModel");
const transactionModel = require("../models/transactionModel");
const paymentLogModel = require("../models/paymentLogModel");

const router = express.Router();

router.get("/api/orders", async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
        const orders = await orderModel.listOrders(limit);
        return res.status(200).json({
            success: true,
            data: orders
        });
    } catch (error) {
        return next(error);
    }
});

router.get("/api/orders/:id/transactions", async (req, res, next) => {
    try {
        const transactions = await transactionModel.getTransactionsByOrderId(req.params.id);
        return res.status(200).json({
            success: true,
            data: transactions
        });
    } catch (error) {
        return next(error);
    }
});

router.get("/api/orders/:id/logs", async (req, res, next) => {
    try {
        const logs = await paymentLogModel.getLogsByOrderId(req.params.id);
        return res.status(200).json({
            success: true,
            data: logs
        });
    } catch (error) {
        return next(error);
    }
});

router.get("/api/transactions", async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
        const transactions = await transactionModel.listTransactions(limit);
        return res.status(200).json({
            success: true,
            data: transactions
        });
    } catch (error) {
        return next(error);
    }
});

router.get("/api/logs", async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
        const logs = await paymentLogModel.listLogs(limit);
        return res.status(200).json({
            success: true,
            data: logs
        });
    } catch (error) {
        return next(error);
    }
});

module.exports = router;
