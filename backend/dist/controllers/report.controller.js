"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReport = exports.getLedger = exports.getDashboardStats = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const getDashboardStats = async (req, res) => {
    const isAdmin = req.user.role === 'ADMIN';
    try {
        const [totalUsers, totalBalance, totalTransactions, pendingRequests, recentTransactions] = await Promise.all([
            prisma_1.default.user.count({ where: isAdmin ? {} : { parentId: req.user.id } }),
            prisma_1.default.wallet.aggregate({ _sum: { balance: true }, where: isAdmin ? {} : { userId: req.user.id } }),
            prisma_1.default.serviceRequest.count({ where: isAdmin ? {} : { userId: req.user.id } }),
            prisma_1.default.serviceRequest.count({ where: { status: 'PENDING', ...(isAdmin ? {} : { userId: req.user.id }) } }),
            prisma_1.default.serviceRequest.findMany({
                where: isAdmin ? {} : { userId: req.user.id },
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: { user: { include: { profile: true } } },
            }),
        ]);
        res.json({
            success: true,
            stats: {
                totalUsers,
                totalBalance: totalBalance._sum.balance ?? 0,
                totalTransactions,
                pendingRequests,
                recentTransactions,
            },
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getDashboardStats = getDashboardStats;
const getLedger = async (req, res) => {
    const from = req.query.from;
    const to = req.query.to;
    const page = req.query.page || '1';
    const limit = req.query.limit || '20';
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    const where = req.user.role === 'ADMIN'
        ? {}
        : {
            OR: [
                { receiverId: req.user.id },
                { senderId: req.user.id },
            ],
        };
    if (from || to) {
        where.createdAt = {};
        if (from)
            where.createdAt.gte = new Date(from);
        if (to)
            where.createdAt.lte = new Date(to);
    }
    try {
        const [transactions, total] = await Promise.all([
            prisma_1.default.walletTransaction.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    sender: { include: { profile: true } },
                    receiver: { include: { profile: true } },
                    serviceRequest: {
                        include: {
                            companyBankAccount: true,
                            user: {
                                include: { profile: true },
                            },
                        },
                    },
                },
            }),
            prisma_1.default.walletTransaction.count({ where }),
        ]);
        res.json({ success: true, transactions, total });
    }
    catch {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getLedger = getLedger;
const getReport = async (req, res) => {
    const type = req.query.type;
    const from = req.query.from;
    const to = req.query.to;
    const filterUserId = req.query.userId;
    const page = req.query.page || '1';
    const limit = req.query.limit || '20';
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    const where = {};
    if (filterUserId)
        where.userId = filterUserId;
    if (from || to) {
        where.createdAt = {};
        if (from)
            where.createdAt.gte = new Date(from);
        if (to)
            where.createdAt.lte = new Date(to);
    }
    if (type === 'payout_pending') {
        where.serviceType = 'PAYOUT';
        where.status = 'PENDING';
    }
    else if (type === 'payout_history') {
        where.serviceType = 'PAYOUT';
    }
    else if (type === 'distributor') {
        const distributors = await prisma_1.default.user.findMany({
            where: { role: 'DISTRIBUTOR', parentId: req.user.id },
            select: { id: true },
        });
        where.userId = { in: distributors.map((d) => d.id) };
    }
    else if (type === 'retailer') {
        const retailers = await prisma_1.default.user.findMany({
            where: { role: 'RETAILER', parentId: req.user.id },
            select: { id: true },
        });
        where.userId = { in: retailers.map((r) => r.id) };
    }
    if (req.user.role !== 'ADMIN' && !filterUserId && !where.userId) {
        where.userId = req.user.id;
    }
    try {
        const [requests, total] = await Promise.all([
            prisma_1.default.serviceRequest.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: { user: { include: { profile: true } } },
            }),
            prisma_1.default.serviceRequest.count({ where }),
        ]);
        res.json({ success: true, requests, total });
    }
    catch {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getReport = getReport;
