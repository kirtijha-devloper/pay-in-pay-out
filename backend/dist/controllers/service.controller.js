"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServiceRequests = exports.submitPayout = exports.getPayoutQuote = exports.verifyBank = exports.verifyBankCached = exports.getVerifiedBankBeneficiaries = exports.updateBankVerificationFee = exports.getBankVerificationFee = exports.rejectFundRequest = exports.approveFundRequest = exports.submitFundRequest = exports.toggleCompanyBankAccount = exports.upsertCompanyBankAccount = exports.getCompanyBankAccounts = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../lib/prisma"));
const commission_service_1 = require("../services/commission.service");
const bankVerification_service_1 = require("../services/bankVerification.service");
const payout_service_1 = require("../services/payout.service");
const notification_service_1 = require("../services/notification.service");
const userHierarchy_service_1 = require("../services/userHierarchy.service");
function toNumberAmount(value) {
    return Number(value || 0);
}
async function creditWallet(tx, userId, amount, description, senderId, serviceRequestId) {
    const updatedWallet = await tx.wallet.upsert({
        where: { userId },
        create: { userId, balance: amount },
        update: { balance: { increment: amount } },
    });
    await tx.walletTransaction.create({
        data: {
            amount,
            type: 'CREDIT',
            description,
            senderId,
            receiverId: userId,
            receiverBalAfter: updatedWallet.balance,
            serviceRequestId,
        },
    });
}
async function distributeFundRequestCharge(tx, requestUserId, shares, serviceRequestId) {
    for (const share of shares) {
        await creditWallet(tx, share.receiverId, share.amount, 'Commission Earned | Fund Request', requestUserId, serviceRequestId);
    }
}
const getCompanyBankAccounts = async (req, res) => {
    try {
        const isAdmin = req.user.role === 'ADMIN';
        const accounts = await prisma_1.default.companyBankAccount.findMany({
            where: isAdmin ? {} : { isActive: true },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        email: true,
                        role: true,
                        profile: {
                            select: { ownerName: true, shopName: true },
                        },
                    },
                },
                updatedBy: {
                    select: {
                        id: true,
                        email: true,
                        role: true,
                    },
                },
            },
            orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        });
        res.json({ success: true, accounts });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getCompanyBankAccounts = getCompanyBankAccounts;
const upsertCompanyBankAccount = async (req, res) => {
    const { id, bankName, accountNumber, confirmAccountNumber, ifscCode, isActive } = req.body;
    try {
        if (!bankName || !accountNumber || !confirmAccountNumber || !ifscCode) {
            res.status(400).json({ success: false, message: 'All bank account fields are required' });
            return;
        }
        if (String(accountNumber).trim() !== String(confirmAccountNumber).trim()) {
            res.status(400).json({ success: false, message: 'Account number confirmation does not match' });
            return;
        }
        const normalizedBankName = String(bankName).trim();
        const normalizedAccountNumber = String(accountNumber).trim();
        const normalizedIfscCode = String(ifscCode).trim().toUpperCase();
        const normalizedIsActive = typeof isActive === 'boolean' ? isActive : String(isActive) !== 'false';
        const qrCodePath = req.file ? req.file.path.replace(/\\/g, '/') : undefined;
        const payload = {
            bankName: normalizedBankName,
            accountNumber: normalizedAccountNumber,
            ifscCode: normalizedIfscCode,
            isActive: normalizedIsActive,
            updatedById: req.user.id,
            ...(qrCodePath && { qrCodePath }),
        };
        const account = id
            ? await prisma_1.default.companyBankAccount.update({
                where: { id },
                data: payload,
            })
            : await prisma_1.default.companyBankAccount.create({
                data: {
                    ...payload,
                    createdById: req.user.id,
                },
            });
        res.json({ success: true, account });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.upsertCompanyBankAccount = upsertCompanyBankAccount;
const toggleCompanyBankAccount = async (req, res) => {
    try {
        const accountId = String(req.params.id);
        const account = await prisma_1.default.companyBankAccount.findUnique({ where: { id: accountId } });
        if (!account) {
            res.status(404).json({ success: false, message: 'Bank account not found' });
            return;
        }
        const updated = await prisma_1.default.companyBankAccount.update({
            where: { id: account.id },
            data: {
                isActive: !account.isActive,
                updatedById: req.user.id,
            },
        });
        res.json({ success: true, account: updated });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.toggleCompanyBankAccount = toggleCompanyBankAccount;
const submitFundRequest = async (req, res) => {
    const { amount, bankRef, paymentDate, paymentMode, remark, bankAccountId } = req.body;
    const receiptFile = req.file;
    try {
        // const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
        // if (!user || user.kycStatus !== 'VERIFIED') {
        //   res.status(403).json({
        //     success: false,
        //     message: 'KYC not verified. Please submit your KYC request from the KYC Verification page first.',
        //   });
        //   return;
        // }
        if (!bankAccountId) {
            res.status(400).json({ success: false, message: 'Please select a company bank account' });
            return;
        }
        if (!receiptFile) {
            res.status(400).json({ success: false, message: 'Please upload a receipt image or PDF' });
            return;
        }
        const account = await prisma_1.default.companyBankAccount.findUnique({ where: { id: bankAccountId } });
        if (!account || !account.isActive) {
            res.status(400).json({ success: false, message: 'Selected bank account is not available' });
            return;
        }
        const request = await prisma_1.default.serviceRequest.create({
            data: {
                userId: req.user.id,
                serviceType: 'FUND_REQUEST',
                amount: new client_1.Prisma.Decimal(amount),
                bankRef,
                paymentDate: paymentDate ? new Date(paymentDate) : undefined,
                paymentMode,
                remark,
                receiptPath: receiptFile.path,
                companyBankAccountId: bankAccountId,
                status: 'PENDING',
            },
        });
        await (0, notification_service_1.notifyAdminsAndUser)(req.user.id, 'New Fund Request', `Fund request of Rs ${amount} was submitted by ${req.user.role}.`, 'INFO');
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
        const request = await prisma_1.default.serviceRequest.findUnique({
            where: { id },
            include: {
                companyBankAccount: true,
            },
        });
        if (!request || request.status !== 'PENDING') {
            res.status(400).json({ success: false, message: 'Invalid request' });
            return;
        }
        // Hierarchy Check
        const hierarchyUsers = await (0, userHierarchy_service_1.fetchHierarchyUsers)();
        if (!(0, userHierarchy_service_1.canManageTarget)(req.user, request.userId, hierarchyUsers)) {
            res.status(403).json({ success: false, message: 'Forbidden: You cannot manage this user hierarchy' });
            return;
        }
        const grossAmount = new client_1.Prisma.Decimal(request.amount || 0);
        if (grossAmount.lte(0)) {
            res.status(400).json({ success: false, message: 'Request amount must be greater than zero' });
            return;
        }
        const charge = new client_1.Prisma.Decimal(await (0, commission_service_1.resolveCharge)(request.userId, 'FUND_REQUEST', toNumberAmount(request.amount)));
        const creditedAmount = grossAmount.minus(charge).toDecimalPlaces(2);
        if (creditedAmount.lte(0)) {
            res.status(400).json({ success: false, message: 'Resolved charge cannot exceed the request amount' });
            return;
        }
        const shares = await (0, commission_service_1.buildChargeDistribution)(request.userId, 'FUND_REQUEST', grossAmount);
        const approver = await prisma_1.default.user.findUnique({ where: { id: req.user.id } });
        const approverLabel = approver?.email || 'Admin';
        await prisma_1.default.$transaction(async (tx) => {
            const updated = await tx.serviceRequest.updateMany({
                where: { id, status: 'PENDING' },
                data: {
                    status: 'SUCCESS',
                    approvedById: req.user.id,
                    approvedAt: new Date(),
                    chargeAmount: charge,
                    creditedAmount,
                    chargeDistribution: JSON.stringify(shares),
                },
            });
            if (updated.count === 0) {
                throw new Error('This request has already been processed or is no longer pending.');
            }
            await creditWallet(tx, request.userId, grossAmount.toNumber(), `Wallet Top-up | Fund Request approved by ${approverLabel}`, request.userId, id);
            if (charge.toNumber() > 0) {
                const updatedWallet = await tx.wallet.update({
                    where: { userId: request.userId },
                    data: { balance: { decrement: charge.toNumber() } },
                });
                await tx.walletTransaction.create({
                    data: {
                        amount: charge.toNumber(),
                        type: 'DEBIT',
                        description: `Fund Request Charges | Approved by ${approverLabel} | Charges Deducted`,
                        senderId: request.userId,
                        receiverId: request.userId,
                        senderBalAfter: updatedWallet.balance,
                        receiverBalAfter: updatedWallet.balance,
                        serviceRequestId: id,
                    },
                });
            }
            await distributeFundRequestCharge(tx, request.userId, shares, id);
        });
        await (0, notification_service_1.notifyAdminsAndUser)(request.userId, 'Fund Request Approved', `Fund request for Rs ${request.amount} has been approved. Rs ${creditedAmount} has been credited to the wallet.`, 'SUCCESS');
        res.json({
            success: true,
            message: 'Fund request approved and wallet credited',
            charge: charge.toNumber(),
            creditedAmount: creditedAmount.toNumber(),
        });
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
        const updated = await prisma_1.default.serviceRequest.updateMany({
            where: { id, status: 'PENDING' },
            data: {
                status: 'FAILED',
                rejectedById: req.user.id,
                rejectedAt: new Date(),
            },
        });
        if (updated.count === 0) {
            res.status(400).json({ success: false, message: 'Request already processed or not pending' });
            return;
        }
        const request = await prisma_1.default.serviceRequest.findUnique({ where: { id } });
        if (request) {
            // Hierarchy Check
            const hierarchyUsers = await (0, userHierarchy_service_1.fetchHierarchyUsers)();
            if (!(0, userHierarchy_service_1.canManageTarget)(req.user, request.userId, hierarchyUsers)) {
                res.status(403).json({ success: false, message: 'Forbidden: You cannot manage this user hierarchy' });
                return;
            }
            await (0, notification_service_1.notifyAdminsAndUser)(request.userId, 'Fund Request Rejected', `Fund request for Rs ${request.amount} has been rejected by ${req.user.role}.`, 'ERROR');
        }
        res.json({ success: true, message: 'Fund request rejected' });
    }
    catch {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.rejectFundRequest = rejectFundRequest;
const getBankVerificationFee = async (_req, res) => {
    try {
        const fee = await (0, bankVerification_service_1.getBankVerificationFee)();
        res.json({ success: true, fee });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getBankVerificationFee = getBankVerificationFee;
const updateBankVerificationFee = async (req, res) => {
    try {
        const amount = req.body?.amount;
        if (amount === undefined || amount === null || amount === '') {
            res.status(400).json({ success: false, message: 'Fee amount is required' });
            return;
        }
        const normalized = Number(amount);
        if (Number.isNaN(normalized) || normalized < 0) {
            res.status(400).json({ success: false, message: 'Fee amount must be a valid number' });
            return;
        }
        const fee = await (0, bankVerification_service_1.updateBankVerificationFee)(normalized);
        await (0, notification_service_1.createAdminNotification)('Bank Verification Fee Updated', `${req.user.role} updated the bank verification fee to Rs ${normalized}.`, 'INFO');
        res.json({ success: true, fee });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.updateBankVerificationFee = updateBankVerificationFee;
const getVerifiedBankBeneficiaries = async (req, res) => {
    try {
        const beneficiaries = await (0, bankVerification_service_1.listSavedBeneficiaries)(req.user.id);
        res.json({ success: true, beneficiaries });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getVerifiedBankBeneficiaries = getVerifiedBankBeneficiaries;
const verifyBankCached = async (req, res) => {
    try {
        const result = await (0, bankVerification_service_1.verifyBankBeneficiary)(req.user.id, req.body);
        res.json(result);
    }
    catch (err) {
        const statusCode = err?.statusCode || 500;
        console.error(err);
        res.status(statusCode).json({
            success: false,
            message: err instanceof Error ? err.message : 'Server error',
        });
    }
};
exports.verifyBankCached = verifyBankCached;
const verifyBank = async (req, res) => {
    const { bankName, accountName, accountNumber, ifscCode } = req.body;
    const userId = req.user.id;
    try {
        const charge = await (0, commission_service_1.resolveCharge)(userId, 'BANK_VERIFICATION', 0);
        const wallet = await prisma_1.default.wallet.findUnique({ where: { userId } });
        if (!wallet || Number(wallet.balance) < charge) {
            res.status(400).json({ success: false, message: `Insufficient balance. Charge: ₹${charge}` });
            return;
        }
        const shares = await (0, commission_service_1.buildChargeDistribution)(userId, 'BANK_VERIFICATION', charge);
        await prisma_1.default.$transaction(async (tx) => {
            const updatedWallet = await tx.wallet.update({ where: { userId }, data: { balance: { decrement: charge } } });
            const request = await tx.serviceRequest.create({
                data: {
                    userId,
                    serviceType: 'BANK_VERIFICATION',
                    amount: charge,
                    bankName,
                    accountName,
                    accountNumber,
                    ifscCode,
                    status: 'SUCCESS',
                    chargeAmount: charge,
                    chargeDistribution: JSON.stringify(shares),
                },
            });
            await tx.walletTransaction.create({
                data: {
                    amount: charge,
                    type: 'DEBIT',
                    status: 'SUCCESS',
                    description: 'Bank Verification | Charges Deducted',
                    senderId: userId,
                    receiverId: userId,
                    senderBalAfter: updatedWallet.balance,
                    receiverBalAfter: updatedWallet.balance,
                    serviceRequestId: request.id,
                },
            });
        });
        for (const share of shares) {
            const updatedWallet = await prisma_1.default.wallet.upsert({
                where: { userId: share.receiverId },
                create: { userId: share.receiverId, balance: share.amount },
                update: { balance: { increment: share.amount } },
            });
            await prisma_1.default.walletTransaction.create({
                data: {
                    amount: share.amount,
                    type: 'CREDIT',
                    description: 'Commission Earned | Bank Verification',
                    senderId: userId,
                    receiverId: share.receiverId,
                    receiverBalAfter: updatedWallet.balance,
                },
            });
        }
        res.json({ success: true, message: 'Bank verified successfully', charge });
        await (0, notification_service_1.notifyAdminsAndUser)(userId, 'Bank Verification Successful', `Bank account ${accountNumber} has been successfully verified.`, 'SUCCESS');
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.verifyBank = verifyBank;
const getPayoutQuote = async (req, res) => {
    const amount = req.query.amount ?? req.body?.amount;
    try {
        const quote = await (0, payout_service_1.getPayoutQuote)(req.user.id, amount);
        res.json({ success: true, quote });
    }
    catch (err) {
        const statusCode = err?.statusCode || 500;
        res.status(statusCode).json({
            success: false,
            message: err instanceof Error ? err.message : 'Server error',
        });
    }
};
exports.getPayoutQuote = getPayoutQuote;
const submitPayout = async (req, res) => {
    try {
        const result = await (0, payout_service_1.submitPayoutRequest)(req.user.id, req.body);
        if (result.success) {
            await (0, notification_service_1.notifyAdminsAndUser)(req.user.id, 'Payout Request Submitted', `Payout request for Rs ${req.body.amount} has been submitted by ${req.user.role}.`, 'INFO');
        }
        res.status(result.success ? 200 : 400).json(result);
    }
    catch (err) {
        const statusCode = err?.statusCode || 500;
        console.error(err);
        res.status(statusCode).json({
            success: false,
            message: err instanceof Error ? err.message : 'Server error',
            requestId: err?.requestId,
            settlement: err?.settlement,
        });
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
    if (req.user.role !== 'ADMIN') {
        const hierarchyUsers = await (0, userHierarchy_service_1.fetchHierarchyUsers)();
        const descendantIds = (0, userHierarchy_service_1.getDescendantIds)(req.user.id, hierarchyUsers);
        where.userId = { in: [req.user.id, ...descendantIds] };
        // If specific filterUserId requested, ensure it's in descendantIds
        if (filterUserId && !descendantIds.includes(filterUserId) && filterUserId !== req.user.id) {
            res.status(403).json({ success: false, message: 'Forbidden' });
            return;
        }
    }
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
                include: {
                    user: { include: { profile: true } },
                    companyBankAccount: true,
                    approvedBy: {
                        select: {
                            id: true,
                            email: true,
                            role: true,
                        },
                    },
                    rejectedBy: {
                        select: {
                            id: true,
                            email: true,
                            role: true,
                        },
                    },
                },
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
