"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCommissionReport = exports.getReport = exports.getLedger = exports.getDashboardStats = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../lib/prisma"));
const userHierarchy_service_1 = require("../services/userHierarchy.service");
const getDashboardStats = async (req, res) => {
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER';
    try {
        const from = req.query.from;
        const to = req.query.to;
        const startTime = from ? new Date(from) : new Date();
        if (!from)
            startTime.setDate(startTime.getDate() - 15);
        const endTime = to ? new Date(to) : new Date();
        const commonWhere = {
            createdAt: { gte: startTime, lte: endTime },
            ...(isAdmin ? {} : { userId: req.user.id })
        };
        const [totalUsers, totalBalance, totalTransactions, pendingFundRequests, pendingPayouts, recentTransactions] = await Promise.all([
            prisma_1.default.user.count({ where: isAdmin ? {} : { parentId: req.user.id, createdAt: { lte: endTime } } }),
            prisma_1.default.wallet.aggregate({ _sum: { balance: true }, where: isAdmin ? {} : { userId: req.user.id } }),
            prisma_1.default.serviceRequest.count({ where: commonWhere }),
            prisma_1.default.serviceRequest.count({ where: { status: 'PENDING', serviceType: 'FUND_REQUEST', ...commonWhere } }),
            prisma_1.default.serviceRequest.count({ where: { status: 'PENDING', serviceType: 'PAYOUT', ...commonWhere } }),
            prisma_1.default.serviceRequest.findMany({
                where: commonWhere,
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: { user: { include: { profile: true } } },
            })
        ]);
        const toNum = (val) => (val ? Number(val.toString()) : 0);
        let totalCredit = 0;
        let totalDebit = 0;
        let netProfit = 0;
        let totalCharges = 0;
        if (isAdmin) {
            // For Admin: Credit = Pay In (Fund Requests), Debit = Pay Out (Payouts)
            const payInStats = await prisma_1.default.serviceRequest.aggregate({
                _sum: { amount: true, chargeAmount: true },
                where: { serviceType: 'FUND_REQUEST', status: 'SUCCESS', createdAt: { gte: startTime, lte: endTime } }
            });
            const payOutStats = await prisma_1.default.serviceRequest.aggregate({
                _sum: { amount: true, chargeAmount: true },
                where: { serviceType: 'PAYOUT', status: 'SUCCESS', createdAt: { gte: startTime, lte: endTime } }
            });
            const commissionStats = await prisma_1.default.walletTransaction.aggregate({
                _sum: { amount: true },
                where: {
                    type: 'CREDIT',
                    description: { contains: 'Commission', mode: 'insensitive' },
                    createdAt: { gte: startTime, lte: endTime }
                }
            });
            totalCredit = toNum(payInStats._sum.amount);
            totalDebit = toNum(payOutStats._sum.amount);
            netProfit = toNum(commissionStats._sum.amount);
            totalCharges = toNum(payInStats._sum.chargeAmount) + toNum(payOutStats._sum.chargeAmount);
        }
        else {
            // For Users: Standard Wallet View
            const [creditStats, debitStats, chargeStats] = await Promise.all([
                prisma_1.default.walletTransaction.aggregate({
                    _sum: { amount: true },
                    where: {
                        type: 'CREDIT',
                        receiverId: req.user.id,
                        createdAt: { gte: startTime, lte: endTime }
                    }
                }),
                prisma_1.default.walletTransaction.aggregate({
                    _sum: { amount: true },
                    where: {
                        type: 'DEBIT',
                        receiverId: req.user.id,
                        createdAt: { gte: startTime, lte: endTime },
                        NOT: [
                            { description: { contains: 'Charge', mode: 'insensitive' } },
                            { description: { contains: 'Deducted', mode: 'insensitive' } },
                            { description: { contains: 'Fee', mode: 'insensitive' } }
                        ]
                    }
                }),
                prisma_1.default.walletTransaction.aggregate({
                    _sum: { amount: true },
                    where: {
                        type: 'DEBIT',
                        receiverId: req.user.id,
                        createdAt: { gte: startTime, lte: endTime },
                        OR: [
                            { description: { contains: 'Charge', mode: 'insensitive' } },
                            { description: { contains: 'Deducted', mode: 'insensitive' } },
                            { description: { contains: 'Fee', mode: 'insensitive' } }
                        ]
                    }
                })
            ]);
            totalCredit = toNum(creditStats._sum.amount);
            totalDebit = toNum(debitStats._sum.amount);
            totalCharges = toNum(chargeStats._sum.amount);
            netProfit = totalCredit - totalDebit - totalCharges;
        }
        // Get daily stats for the chart
        const dailyStats = await prisma_1.default.$queryRaw `
      SELECT 
        DATE_TRUNC('day', "createdAt") as date,
        COUNT(*)::int as transactions,
        COALESCE(SUM("amount"), 0)::float as volume
      FROM "ServiceRequest"
      WHERE "createdAt" >= ${startTime} AND "createdAt" <= ${endTime}
      AND "status" = 'SUCCESS'
      ${isAdmin ? client_1.Prisma.empty : client_1.Prisma.sql `AND "userId" = ${req.user.id}::text`}
      GROUP BY 1
      ORDER BY 1 ASC
    `;
        // Map to a format Recharts likes
        const chartData = dailyStats.map(d => ({
            name: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            revenue: d.volume,
            transactions: d.transactions
        }));
        res.json({
            success: true,
            stats: {
                totalUsers,
                totalBalance: toNum(totalBalance._sum.balance),
                totalTransactions,
                totalCredit,
                totalDebit,
                totalCharges,
                netProfit,
                pendingFundRequests,
                pendingPayouts,
                recentTransactions,
                chartData
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
                { senderId: req.user.id, type: 'DEBIT' },
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
const REPORT_RECEIVER_SCOPE = {
    ADMIN: ['ADMIN', 'SUPER', 'DISTRIBUTOR', 'RETAILER'],
    SUPER: ['SUPER', 'DISTRIBUTOR'],
    DISTRIBUTOR: ['DISTRIBUTOR'],
    RETAILER: ['RETAILER'],
};
const getCommissionReport = async (req, res) => {
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '20');
    const skip = (page - 1) * limit;
    const where = {
        status: 'SUCCESS',
        chargeAmount: { gt: 0 },
    };
    let descendantIds = [];
    if (req.user.role !== 'ADMIN') {
        const hierarchyUsers = await (0, userHierarchy_service_1.fetchHierarchyUsers)();
        descendantIds = (0, userHierarchy_service_1.getDescendantIds)(req.user.id, hierarchyUsers);
        where.userId = { in: [req.user.id, ...descendantIds] };
    }
    try {
        const [requests, total] = await Promise.all([
            prisma_1.default.serviceRequest.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: { user: { include: { profile: true } } },
            }),
            prisma_1.default.serviceRequest.count({ where }),
        ]);
        const hierarchyUsers = await (0, userHierarchy_service_1.fetchHierarchyUsers)();
        const userMap = new Map(hierarchyUsers.map((u) => [u.id, u]));
        const visibleUserIds = new Set([String(req.user.id), ...descendantIds.map((id) => String(id))]);
        const allowedReceiverRoles = new Set(REPORT_RECEIVER_SCOPE[req.user.role] || []);
        const receiverIds = new Set();
        const filteredRequests = requests.map((r) => {
            if (!r.chargeDistribution)
                return r;
            try {
                const distribution = JSON.parse(r.chargeDistribution);
                const filteredDist = req.user.role === 'ADMIN'
                    ? distribution
                    : distribution.filter((entry) => {
                        const receiverId = String(entry.receiverId || '');
                        const receiver = userMap.get(receiverId);
                        if (!receiver || !visibleUserIds.has(receiverId)) {
                            return false;
                        }
                        return allowedReceiverRoles.has(receiver.role);
                    });
                filteredDist.forEach((entry) => {
                    if (entry.receiverId)
                        receiverIds.add(String(entry.receiverId));
                });
                return {
                    ...r,
                    chargeDistribution: JSON.stringify(filteredDist)
                };
            }
            catch (e) {
                console.error('[CommissionReport] Parse error:', e);
                return r;
            }
        });
        const receivers = await prisma_1.default.user.findMany({
            where: { id: { in: Array.from(receiverIds) } },
            select: {
                id: true,
                email: true,
                role: true,
                profile: { select: { ownerName: true, shopName: true } }
            }
        });
        res.json({ success: true, requests: filteredRequests, total, users: receivers });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getCommissionReport = getCommissionReport;
