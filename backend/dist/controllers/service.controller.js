"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServiceRequests = exports.submitPayout = exports.verifyBank = exports.rejectFundRequest = exports.approveFundRequest = exports.submitFundRequest = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
// Helper: get applicable commission for a role and amount
async function getCharge(userId, serviceType, amount) {
    // Check user-specific override first
    const override = await prisma_1.default.userCommissionSetup.findFirst({
        where: { targetUserId: userId, serviceType, isActive: true },
    });
    if (override) {
        const min = override.minAmount ? Number(override.minAmount) : 0;
        const max = override.maxAmount ? Number(override.maxAmount) : Infinity;
        if (amount >= min && amount <= max) {
            return override.commissionType === 'PERCENTAGE'
                ? (amount * Number(override.commissionValue)) / 100
                : Number(override.commissionValue);
        }
    }
    // Fall back to global slab
    const slab = await prisma_1.default.commissionSlab.findFirst({
        where: {
            serviceType,
            isActive: true,
            OR: [
                {
                    minAmount: null,
                    maxAmount: null,
                },
                {
                    minAmount: null,
                    maxAmount: { gte: amount },
                },
                {
                    minAmount: { lte: amount },
                    maxAmount: null,
                },
                {
                    minAmount: { lte: amount },
                    maxAmount: { gte: amount },
                },
            ],
        },
        orderBy: [{ minAmount: 'desc' }, { maxAmount: 'asc' }],
    });
    if (slab) {
        return slab.commissionType === 'PERCENTAGE'
            ? (amount * Number(slab.commissionValue)) / 100
            : Number(slab.commissionValue);
    }
    return 0;
}
// Helper: distribute commission up the chain
async function distributeCommissions(userId, serviceType, amount) {
    let currentId = userId;
    let level = 0;
    while (currentId && level < 5) {
        const currentUser = await prisma_1.default.user.findUnique({
            where: { id: currentId },
            select: { parentId: true },
        });
        if (!currentUser || !currentUser.parentId)
            break;
        const parentId = currentUser.parentId;
        const commission = await getCharge(parentId, serviceType, amount);
        if (commission > 0) {
            const updatedWallet = await prisma_1.default.wallet.upsert({
                where: { userId: parentId },
                create: { userId: parentId, balance: commission },
                update: { balance: { increment: commission } },
            });
            await prisma_1.default.walletTransaction.create({
                data: {
                    amount: commission,
                    type: 'CREDIT',
                    description: `Commission from downline ${serviceType}`,
                    senderId: userId,
                    senderBalAfter: 0,
                    receiverId: parentId,
                    receiverBalAfter: updatedWallet.balance,
                },
            });
        }
        currentId = currentUser.parentId;
        level++;
    }
}
const submitFundRequest = async (req, res) => {
    const { amount, bankRef, paymentDate, paymentMode, remark, bankAccountId } = req.body;
    try {
        const request = await prisma_1.default.serviceRequest.create({
            data: {
                userId: req.user.id,
                serviceType: 'FUND_REQUEST',
                amount,
                bankRef,
                paymentDate: paymentDate ? new Date(paymentDate) : undefined,
                paymentMode,
                remark,
                status: 'PENDING',
            },
        });
        res.status(201).json({ success: true, request });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.submitFundRequest = submitFundRequest;
const approveFundRequest = async (req, res) => {
    const id = req.params.id;
    try {
        const request = await prisma_1.default.serviceRequest.findUnique({ where: { id } });
        if (!request || request.status !== 'PENDING') {
            res.status(400).json({ success: false, message: 'Invalid request' });
            return;
        }
        const amt = Number(request.amount);
        await prisma_1.default.$transaction([
            prisma_1.default.serviceRequest.update({ where: { id }, data: { status: 'SUCCESS' } }),
            prisma_1.default.wallet.upsert({
                where: { userId: request.userId },
                create: { userId: request.userId, balance: amt },
                update: { balance: { increment: amt } },
            }),
            prisma_1.default.walletTransaction.create({
                data: {
                    amount: amt,
                    type: 'CREDIT',
                    description: 'Fund Request Approved',
                    receiverId: request.userId,
                    receiverBalAfter: amt,
                },
            }),
        ]);
        res.json({ success: true, message: 'Fund request approved and wallet credited' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.approveFundRequest = approveFundRequest;
const rejectFundRequest = async (req, res) => {
    const id = req.params.id;
    try {
        await prisma_1.default.serviceRequest.update({ where: { id }, data: { status: 'FAILED' } });
        res.json({ success: true, message: 'Fund request rejected' });
    }
    catch {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.rejectFundRequest = rejectFundRequest;
const verifyBank = async (req, res) => {
    const { bankName, accountName, accountNumber, ifscCode } = req.body;
    const userId = req.user.id;
    try {
        const charge = await getCharge(userId, 'BANK_VERIFICATION', 0);
        const wallet = await prisma_1.default.wallet.findUnique({ where: { userId } });
        if (!wallet || Number(wallet.balance) < charge) {
            res.status(400).json({ success: false, message: `Insufficient balance. Charge: ₹${charge}` });
            return;
        }
        await prisma_1.default.$transaction([
            prisma_1.default.wallet.update({ where: { userId }, data: { balance: { decrement: charge } } }),
            prisma_1.default.serviceRequest.create({
                data: {
                    userId,
                    serviceType: 'BANK_VERIFICATION',
                    amount: charge,
                    bankName,
                    accountName,
                    accountNumber,
                    ifscCode,
                    status: 'SUCCESS',
                },
            }),
        ]);
        await distributeCommissions(userId, 'BANK_VERIFICATION', charge);
        res.json({ success: true, message: 'Bank verified successfully', charge });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.verifyBank = verifyBank;
const submitPayout = async (req, res) => {
    const { amount, bankName, accountName, accountNumber, ifscCode, remark } = req.body;
    const userId = req.user.id;
    try {
        const charge = await getCharge(userId, 'PAYOUT', amount);
        const total = amount + charge;
        const wallet = await prisma_1.default.wallet.findUnique({ where: { userId } });
        if (!wallet || Number(wallet.balance) < total) {
            res.status(400).json({ success: false, message: `Insufficient balance. Required: ₹${total}` });
            return;
        }
        await prisma_1.default.$transaction([
            prisma_1.default.wallet.update({ where: { userId }, data: { balance: { decrement: total } } }),
            prisma_1.default.serviceRequest.create({
                data: {
                    userId,
                    serviceType: 'PAYOUT',
                    amount,
                    bankName,
                    accountName,
                    accountNumber,
                    ifscCode,
                    remark,
                    status: 'PENDING',
                },
            }),
        ]);
        await distributeCommissions(userId, 'PAYOUT', amount);
        res.json({ success: true, message: 'Payout submitted for processing', charge });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.submitPayout = submitPayout;
const getServiceRequests = async (req, res) => {
    const serviceType = req.query.serviceType;
    const status = req.query.status;
    const filterUserId = req.query.userId;
    const from = req.query.from;
    const to = req.query.to;
    const page = req.query.page || '1';
    const limit = req.query.limit || '20';
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    const where = {};
    if (serviceType)
        where.serviceType = serviceType;
    if (status)
        where.status = status;
    if (filterUserId)
        where.userId = filterUserId;
    if (req.user.role !== 'ADMIN')
        where.userId = req.user.id;
    if (from || to) {
        where.createdAt = {};
        if (from)
            where.createdAt.gte = new Date(from);
        if (to)
            where.createdAt.lte = new Date(to);
    }
    try {
        const [requests, total] = await Promise.all([
            prisma_1.default.serviceRequest.findMany({
                where,
                skip,
                take,
                include: { user: { include: { profile: true } } },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.default.serviceRequest.count({ where }),
        ]);
        res.json({ success: true, requests, total });
    }
    catch {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getServiceRequests = getServiceRequests;
