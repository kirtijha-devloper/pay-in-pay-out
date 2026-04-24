"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPayoutQuote = getPayoutQuote;
exports.finalizePayoutSettlement = finalizePayoutSettlement;
exports.submitPayoutRequest = submitPayoutRequest;
exports.syncPendingPayouts = syncPendingPayouts;
exports.processBranchxPayoutCallback = processBranchxPayoutCallback;
exports.listBranchxCallbackIps = listBranchxCallbackIps;
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = require("crypto");
const prisma_1 = __importDefault(require("../lib/prisma"));
const commission_service_1 = require("./commission.service");
const branchx_service_1 = require("./branchx.service");
function createHttpError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}
function normalizeText(value) {
    return String(value ?? '').trim();
}
function normalizeBoolean(value) {
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'number')
        return value !== 0;
    const text = normalizeText(value).toLowerCase();
    return ['true', '1', 'yes', 'on'].includes(text);
}
function buildRequestId() {
    return `BXP-${Date.now()}-${(0, crypto_1.randomUUID)().slice(0, 8).toUpperCase()}`;
}
function stringifyPayload(value) {
    if (value === undefined) {
        return null;
    }
    if (typeof value === 'string') {
        return value;
    }
    try {
        return JSON.stringify(value);
    }
    catch {
        return String(value);
    }
}
function normalizeIp(value) {
    const text = normalizeText(value);
    if (!text) {
        return 'unknown';
    }
    return text.replace(/^::ffff:/i, '');
}
function extractCallbackIdentifier(payload, keys) {
    for (const key of keys) {
        const value = payload[key];
        if (value === undefined || value === null) {
            continue;
        }
        const normalized = normalizeText(value);
        if (normalized) {
            return normalized;
        }
    }
    return null;
}
function extractBranchxCallbackIdentifiers(payload) {
    const requestId = extractCallbackIdentifier(payload, ['requestId', 'requestid']);
    const opRefId = extractCallbackIdentifier(payload, ['opRefId', 'oprefid']);
    const apiTxnId = extractCallbackIdentifier(payload, ['apiTxnId', 'apitxnid']);
    const fallbackRequestId = requestId || opRefId || apiTxnId || null;
    return {
        requestId,
        opRefId,
        apiTxnId,
        fallbackRequestId,
    };
}
function extractBranchxCallbackStatus(payload) {
    return normalizeText(payload.status ??
        payload.Status ??
        payload.data?.status ??
        payload.data?.Status);
}
async function persistPayoutProviderResponse(requestId, providerStatus, providerStatusCode, providerResponse) {
    await prisma_1.default.serviceRequest.update({
        where: { id: requestId },
        data: {
            providerStatus,
            providerStatusCode: providerStatusCode || null,
            providerResponse: stringifyPayload(providerResponse),
        },
    });
}
function parseChargeDistribution(raw) {
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed
            .filter((item) => item && typeof item.receiverId === 'string' && Number(item.amount || 0) > 0)
            .map((item) => ({
            receiverId: item.receiverId,
            amount: Number(item.amount || 0),
        }));
    }
    catch {
        return [];
    }
}
async function getUserWithWalletAndProfile(userId) {
    return prisma_1.default.user.findUnique({
        where: { id: userId },
        include: {
            profile: true,
            wallet: true,
        },
    });
}
async function getVerifiedBeneficiary(userId, beneficiaryId) {
    return prisma_1.default.payoutBeneficiary.findFirst({
        where: {
            id: beneficiaryId,
            userId,
            isVerified: true,
        },
    });
}
async function verifyTransactionPin(user, tpin) {
    if (!user.transactionPinHash) {
        throw createHttpError('Transaction PIN is not set for this account', 400);
    }
    const suppliedPin = normalizeText(tpin);
    if (!suppliedPin) {
        throw createHttpError('Transaction PIN is required', 400);
    }
    const matches = await bcryptjs_1.default.compare(suppliedPin, user.transactionPinHash);
    if (!matches) {
        throw createHttpError('Invalid Transaction PIN', 400);
    }
}
async function getPayoutQuote(userId, amountInput) {
    const normalizedAmount = Number(amountInput);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        throw createHttpError('Payout amount must be greater than zero', 400);
    }
    const amount = (0, commission_service_1.toDecimalAmount)(normalizedAmount);
    if (amount.lte(0)) {
        throw createHttpError('Payout amount must be greater than zero', 400);
    }
    const charge = (0, commission_service_1.toDecimalAmount)(await (0, commission_service_1.resolveCharge)(userId, 'PAYOUT', amount.toNumber()));
    const netAmount = amount.minus(charge).toDecimalPlaces(2);
    if (netAmount.lte(0)) {
        throw createHttpError('Resolved charge cannot exceed the payout amount', 400);
    }
    return {
        amount: amount.toNumber(),
        charge: charge.toNumber(),
        netAmount: netAmount.toNumber(),
        walletRequired: amount.toNumber(),
    };
}
async function reservePayoutRequest(userId, beneficiary, quote, input, chargeDistribution, requestId) {
    return prisma_1.default.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet) {
            throw createHttpError('Wallet not found', 404);
        }
        const availableBalance = Number(wallet.balance) - Number(wallet.minimumHold || 0);
        if (availableBalance < quote.walletRequired) {
            throw createHttpError(`Insufficient balance. Available: ₹${availableBalance.toFixed(2)} (Hold: ₹${Number(wallet.minimumHold || 0).toFixed(2)})`, 400);
        }
        const updatedWallet = await tx.wallet.update({
            where: { userId },
            data: { balance: { decrement: quote.walletRequired } },
        });
        const request = await tx.serviceRequest.create({
            data: {
                userId,
                serviceType: 'PAYOUT',
                amount: new client_1.Prisma.Decimal(quote.amount),
                chargeAmount: new client_1.Prisma.Decimal(quote.charge),
                creditedAmount: new client_1.Prisma.Decimal(quote.netAmount),
                chargeDistribution: JSON.stringify(chargeDistribution),
                bankRef: requestId,
                bankName: beneficiary.bankName,
                accountName: beneficiary.payeeName,
                accountNumber: beneficiary.accountNo,
                ifscCode: beneficiary.bankIfsc,
                paymentMode: normalizeText(input.transferMode) || 'IMPS',
                remark: normalizeText(input.remark) || null,
                status: 'PENDING',
            },
        });
        await tx.walletTransaction.create({
            data: {
                amount: new client_1.Prisma.Decimal(quote.netAmount),
                type: 'DEBIT',
                status: 'PENDING',
                description: 'Payout | Request Submitted',
                senderId: userId,
                receiverId: userId,
                senderBalAfter: updatedWallet.balance,
                receiverBalAfter: updatedWallet.balance,
                serviceRequestId: request.id,
            },
        });
        if (quote.charge > 0) {
            await tx.walletTransaction.create({
                data: {
                    amount: new client_1.Prisma.Decimal(quote.charge),
                    type: 'DEBIT',
                    status: 'PENDING',
                    description: 'Payout Charges | Charges Deducted',
                    senderId: userId,
                    receiverId: userId,
                    senderBalAfter: updatedWallet.balance,
                    receiverBalAfter: updatedWallet.balance,
                    serviceRequestId: request.id,
                },
            });
        }
        return request;
    });
}
async function creditCommissionShares(tx, requestUserId, grossAmount, serviceRequestId, chargeDistribution) {
    let shares = chargeDistribution;
    if (!shares.length) {
        shares = await (0, commission_service_1.buildChargeDistribution)(requestUserId, 'PAYOUT', grossAmount);
    }
    for (const share of shares) {
        if (!share || Number(share.amount || 0) <= 0) {
            continue;
        }
        const updatedWallet = await tx.wallet.upsert({
            where: { userId: share.receiverId },
            create: { userId: share.receiverId, balance: share.amount },
            update: { balance: { increment: share.amount } },
        });
        await tx.walletTransaction.create({
            data: {
                amount: share.amount,
                type: 'CREDIT',
                description: 'Commission Earned | Payout',
                senderId: requestUserId,
                receiverId: share.receiverId,
                receiverBalAfter: updatedWallet.balance,
                serviceRequestId,
            },
        });
    }
}
async function finalizePayoutSettlement(requestId, outcome, providerResponse, settlementSource = 'CRON') {
    return prisma_1.default.$transaction(async (tx) => {
        const request = await tx.serviceRequest.findUnique({
            where: { id: requestId },
            include: {
                walletTransactions: true,
            },
        });
        if (!request || request.serviceType !== 'PAYOUT' || request.status !== 'PENDING') {
            return { skipped: true, request };
        }
        const grossAmount = (0, commission_service_1.toDecimalAmount)(request.amount || 0);
        const chargeAmount = (0, commission_service_1.toDecimalAmount)(request.chargeAmount || 0);
        const netAmount = (0, commission_service_1.toDecimalAmount)(request.creditedAmount || grossAmount.minus(chargeAmount));
        const pendingDebits = request.walletTransactions.filter((transaction) => transaction.type === 'DEBIT' && transaction.status === 'PENDING');
        const chargeDistribution = parseChargeDistribution(request.chargeDistribution);
        const updated = await tx.serviceRequest.updateMany({
            where: { id: requestId, status: 'PENDING' },
            data: {
                status: outcome,
                remark: outcome === 'FAILED'
                    ? normalizeText(request.remark) || normalizeText(providerResponse?.message) || 'Payout failed'
                    : request.remark,
            },
        });
        if (updated.count === 0) {
            return { skipped: true, request };
        }
        if (pendingDebits.length > 0) {
            await tx.walletTransaction.updateMany({
                where: { id: { in: pendingDebits.map((d) => d.id) }, status: 'PENDING' },
                data: { status: outcome },
            });
        }
        if (outcome === 'SUCCESS') {
            await creditCommissionShares(tx, request.userId, grossAmount, request.id, chargeDistribution);
            return {
                skipped: false,
                requestId: request.id,
                status: 'SUCCESS',
                charge: chargeAmount.toNumber(),
                netAmount: netAmount.toNumber(),
                settlementSource,
            };
        }
        const refundedWallet = await tx.wallet.upsert({
            where: { userId: request.userId },
            create: { userId: request.userId, balance: grossAmount },
            update: { balance: { increment: grossAmount } },
        });
        await tx.walletTransaction.create({
            data: {
                amount: netAmount,
                type: 'CREDIT',
                status: 'SUCCESS',
                description: 'Payout refund',
                senderId: null,
                receiverId: request.userId,
                receiverBalAfter: refundedWallet.balance.minus(chargeAmount),
                serviceRequestId: request.id,
            },
        });
        if (chargeAmount.toNumber() > 0) {
            await tx.walletTransaction.create({
                data: {
                    amount: chargeAmount,
                    type: 'CREDIT',
                    status: 'SUCCESS',
                    description: 'Payout commission refund',
                    senderId: null,
                    receiverId: request.userId,
                    receiverBalAfter: refundedWallet.balance,
                    serviceRequestId: request.id,
                },
            });
        }
        return {
            skipped: false,
            requestId: request.id,
            status: 'FAILED',
            charge: chargeAmount.toNumber(),
            netAmount: netAmount.toNumber(),
            settlementSource,
        };
    });
}
async function submitPayoutRequest(userId, input) {
    const user = await getUserWithWalletAndProfile(userId);
    if (!user) {
        throw createHttpError('User not found', 404);
    }
    if (!normalizeBoolean(input.confirmVerified)) {
        throw createHttpError('Please confirm that the beneficiary has been verified', 400);
    }
    await verifyTransactionPin(user, input.tpin);
    const beneficiaryId = normalizeText(input.beneficiaryId);
    if (!beneficiaryId) {
        throw createHttpError('Please select a verified beneficiary', 400);
    }
    const beneficiary = await getVerifiedBeneficiary(userId, beneficiaryId);
    if (!beneficiary) {
        throw createHttpError('Selected beneficiary is not verified or does not belong to this account', 400);
    }
    const quote = await getPayoutQuote(userId, input.amount);
    const amount = (0, commission_service_1.toDecimalAmount)(quote.amount);
    const mobileNumber = normalizeText(user.profile?.mobileNumber);
    if (!mobileNumber) {
        throw createHttpError('Mobile number is required for BranchX payout', 400);
    }
    const chargeDistribution = await (0, commission_service_1.buildChargeDistribution)(userId, 'PAYOUT', amount);
    const requestId = buildRequestId();
    const pendingRequest = await reservePayoutRequest(userId, beneficiary, quote, input, chargeDistribution, requestId);
    try {
        const providerResponse = await (0, branchx_service_1.submitBranchxPayout)({
            amount: quote.netAmount,
            mobileNumber,
            requestId,
            accountNumber: beneficiary.accountNo,
            ifscCode: beneficiary.bankIfsc,
            beneficiaryName: beneficiary.payeeName,
            remitterName: user.profile?.ownerName || user.profile?.shopName || user.email,
            bankName: beneficiary.bankName,
            transferMode: normalizeText(input.transferMode) || 'IMPS',
            latitude: normalizeText(process.env.BRANCHX_LATITUDE) || '0',
            longitude: normalizeText(process.env.BRANCHX_LONGITUDE) || '0',
            emailId: user.email,
            purpose: normalizeText(input.remark) || 'Payout',
        });
        if (providerResponse.status === 'FAILED') {
            await persistPayoutProviderResponse(pendingRequest.id, providerResponse.status, providerResponse.statusCode, providerResponse.raw);
            const finalResult = await finalizePayoutSettlement(pendingRequest.id, 'FAILED', providerResponse.raw, 'BRANCHX_INIT');
            return {
                success: false,
                status: 'FAILED',
                message: providerResponse.message || 'Payout request failed',
                requestId,
                request: pendingRequest,
                charge: quote.charge,
                netAmount: quote.netAmount,
                providerResponse: providerResponse.raw,
                settlement: finalResult,
            };
        }
        await persistPayoutProviderResponse(pendingRequest.id, providerResponse.status, providerResponse.statusCode, providerResponse.raw);
        return {
            success: true,
            status: 'PENDING',
            message: 'Payout request submitted and is pending callback or status check',
            requestId,
            request: pendingRequest,
            charge: quote.charge,
            netAmount: quote.netAmount,
            providerResponse: providerResponse.raw,
        };
    }
    catch (error) {
        try {
            await persistPayoutProviderResponse(pendingRequest.id, 'FAILED', error?.statusCode ? String(error.statusCode) : 'ERROR', {
                message: error instanceof Error ? error.message : 'BranchX payout request failed',
            });
        }
        catch (metadataError) {
            console.warn('[BranchX] payout_initiation_metadata_error', {
                requestId: pendingRequest.id,
                error: metadataError instanceof Error ? metadataError.message : String(metadataError),
            });
        }
        const settled = await finalizePayoutSettlement(pendingRequest.id, 'FAILED', error instanceof Error ? { message: error.message } : { message: 'BranchX payout request failed' }, 'BRANCHX_INIT_ERROR');
        const statusCode = error?.statusCode || 502;
        const message = error instanceof Error ? error.message : 'BranchX payout request failed and the reserved amount was refunded';
        const wrappedError = new Error(message);
        wrappedError.statusCode = statusCode;
        wrappedError.requestId = requestId;
        wrappedError.settlement = settled;
        throw wrappedError;
    }
}
async function syncPendingPayouts() {
    const pendingRequests = await prisma_1.default.serviceRequest.findMany({
        where: {
            serviceType: 'PAYOUT',
            status: 'PENDING',
            bankRef: { not: null },
            createdAt: {
                lte: new Date(Date.now() - 60 * 1000),
            },
        },
        orderBy: { createdAt: 'asc' },
    });
    const results = [];
    for (const request of pendingRequests) {
        try {
            const statusResponse = await (0, branchx_service_1.checkBranchxPayoutStatus)(request.bankRef);
            const normalizedStatus = (0, branchx_service_1.normalizeBranchxStatus)(statusResponse.raw);
            if (normalizedStatus === 'SUCCESS') {
                results.push(await finalizePayoutSettlement(request.id, 'SUCCESS', statusResponse.raw, 'CRON'));
                continue;
            }
            if (normalizedStatus === 'FAILED') {
                results.push(await finalizePayoutSettlement(request.id, 'FAILED', statusResponse.raw, 'CRON'));
                continue;
            }
            results.push({
                requestId: request.id,
                status: 'PENDING',
            });
        }
        catch (error) {
            console.error('[BranchX] payout_sync_error', {
                requestId: request.id,
                error: error instanceof Error ? error.message : String(error),
            });
            results.push({
                requestId: request.id,
                status: 'ERROR',
            });
        }
    }
    return results;
}
async function processBranchxPayoutCallback(payload, meta) {
    const normalizedStatus = (0, branchx_service_1.normalizeBranchxStatus)(payload);
    const rawStatus = extractBranchxCallbackStatus(payload) || null;
    const identifiers = extractBranchxCallbackIdentifiers(payload);
    const candidateIds = [identifiers.requestId, identifiers.opRefId, identifiers.apiTxnId].filter((value) => Boolean(value));
    const requestIdentifier = identifiers.fallbackRequestId;
    const audit = await prisma_1.default.branchxCallbackAudit.create({
        data: {
            requestIdentifier,
            sourceIp: normalizeIp(meta.sourceIp),
            forwardedFor: meta.forwardedFor || null,
            method: normalizeText(meta.method).toUpperCase() || 'UNKNOWN',
            rawStatus,
            normalizedStatus,
            payload: stringifyPayload(payload),
            userAgent: meta.userAgent || null,
        },
    });
    const request = candidateIds.length
        ? await prisma_1.default.serviceRequest.findFirst({
            where: {
                serviceType: 'PAYOUT',
                bankRef: { in: candidateIds },
            },
            orderBy: { createdAt: 'desc' },
        })
        : null;
    if (!request) {
        console.warn('[BranchX] payout_callback_unmatched', {
            requestIdentifier,
            sourceIp: normalizeIp(meta.sourceIp),
            normalizedStatus,
            auditId: audit.id,
        });
        return {
            accepted: true,
            matched: false,
            finalized: false,
            normalizedStatus,
            auditId: audit.id,
            requestId: requestIdentifier,
        };
    }
    await prisma_1.default.branchxCallbackAudit.update({
        where: { id: audit.id },
        data: { serviceRequestId: request.id },
    });
    const currentStatus = normalizeText(request.callbackStatus).toUpperCase();
    const shouldPersistMetadata = !currentStatus || !['SUCCESS', 'FAILED'].includes(currentStatus);
    if (shouldPersistMetadata) {
        await prisma_1.default.serviceRequest.update({
            where: { id: request.id },
            data: {
                callbackStatus: normalizedStatus,
                callbackData: stringifyPayload(payload),
                callbackReceivedAt: new Date(),
                callbackRequestId: identifiers.requestId,
                callbackOpRefId: identifiers.opRefId,
                callbackApiTxnId: identifiers.apiTxnId,
            },
        });
    }
    if (normalizedStatus === 'SUCCESS' || normalizedStatus === 'FAILED') {
        const settlement = await finalizePayoutSettlement(request.id, normalizedStatus, payload, 'CALLBACK');
        return {
            accepted: true,
            matched: true,
            finalized: !settlement.skipped,
            normalizedStatus,
            auditId: audit.id,
            requestId: request.bankRef || requestIdentifier,
        };
    }
    return {
        accepted: true,
        matched: true,
        finalized: false,
        normalizedStatus,
        auditId: audit.id,
        requestId: request.bankRef || requestIdentifier,
    };
}
async function listBranchxCallbackIps() {
    const rows = await prisma_1.default.branchxCallbackAudit.groupBy({
        by: ['sourceIp'],
        _count: { sourceIp: true },
        _min: { createdAt: true },
        _max: { createdAt: true },
        orderBy: { _max: { createdAt: 'desc' } },
    });
    return rows.map((row) => ({
        sourceIp: row.sourceIp,
        count: row._count.sourceIp,
        firstSeenAt: row._min.createdAt,
        lastSeenAt: row._max.createdAt,
    }));
}
