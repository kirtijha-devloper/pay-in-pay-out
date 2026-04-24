"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBankVerificationFee = getBankVerificationFee;
exports.updateBankVerificationFee = updateBankVerificationFee;
exports.listSavedBeneficiaries = listSavedBeneficiaries;
exports.verifyBankBeneficiary = verifyBankBeneficiary;
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const BANK_VERIFICATION_FEE_ID = 'BANK_VERIFICATION';
const BANK_VERIFICATION_FEE_FILE = path_1.default.join(process.cwd(), 'data', 'bank-verification-fee.json');
let bankVerificationSchemaReady = null;
function normalizeText(value) {
    return String(value ?? '').trim();
}
function normalizeIfsc(value) {
    return normalizeText(value).toUpperCase();
}
function normalizeAccountNumber(value) {
    return normalizeText(value).replace(/\s+/g, '');
}
function toDecimal(value) {
    return new client_1.Prisma.Decimal(Number(value || 0).toFixed(2));
}
function maskAccountNumber(value) {
    if (!value)
        return '';
    if (value.length <= 4)
        return '****';
    return `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
}
function redactProviderObject(input) {
    if (!input || typeof input !== 'object')
        return input;
    if (Array.isArray(input)) {
        return input.map((item) => redactProviderObject(item));
    }
    const output = {};
    for (const [key, value] of Object.entries(input)) {
        const lowerKey = key.toLowerCase();
        if (['authcode', 'clientsecret', 'token', 'access_token'].includes(lowerKey)) {
            output[key] = '[REDACTED]';
            continue;
        }
        if (lowerKey.includes('account') || lowerKey.includes('number')) {
            output[key] = typeof value === 'string' ? maskAccountNumber(value) : value;
            continue;
        }
        output[key] = redactProviderObject(value);
    }
    return output;
}
async function ensureBankVerificationSchema() {
    if (!bankVerificationSchemaReady) {
        bankVerificationSchemaReady = (async () => {
            await prisma_1.default.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "BankVerificationFee" (
          "id" TEXT NOT NULL,
          "amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "BankVerificationFee_pkey" PRIMARY KEY ("id")
        )
      `);
            await prisma_1.default.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "payout_beneficiaries" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "payee_name" TEXT NOT NULL,
          "account_no" TEXT NOT NULL,
          "bank_ifsc" TEXT NOT NULL,
          "bank_name" TEXT NOT NULL,
          "is_verified" BOOLEAN NOT NULL DEFAULT false,
          "verified_at" TIMESTAMP(3),
          "provider_ref" TEXT,
          "provider_status_code" TEXT,
          "provider_response" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "payout_beneficiaries_pkey" PRIMARY KEY ("id")
        )
      `);
            await prisma_1.default.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "payout_beneficiaries_userId_account_no_bank_ifsc_key"
        ON "payout_beneficiaries" ("userId", "account_no", "bank_ifsc")
      `);
            await prisma_1.default.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "payout_beneficiaries_userId_idx"
        ON "payout_beneficiaries" ("userId")
      `);
        })().catch((error) => {
            bankVerificationSchemaReady = null;
            throw error;
        });
    }
    return bankVerificationSchemaReady;
}
async function readLocalBankVerificationFee() {
    try {
        const raw = await (0, promises_1.readFile)(BANK_VERIFICATION_FEE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed?.amount === undefined || parsed?.amount === null || parsed.amount === '') {
            return null;
        }
        return toDecimal(parsed.amount);
    }
    catch {
        return null;
    }
}
async function writeLocalBankVerificationFee(amount) {
    await (0, promises_1.mkdir)(path_1.default.dirname(BANK_VERIFICATION_FEE_FILE), { recursive: true });
    await (0, promises_1.writeFile)(BANK_VERIFICATION_FEE_FILE, JSON.stringify({
        amount: Number(amount || 0),
        updatedAt: new Date().toISOString(),
    }, null, 2), 'utf8');
}
function buildProviderUrl() {
    const baseUrl = normalizeText(process.env.IPAY_BASE_URL);
    const endpoint = normalizeText(process.env.IPAY_VERIFY_BANK_ENDPOINT);
    if (!baseUrl || !endpoint) {
        throw new Error('Bank verification API is not configured');
    }
    return new URL(endpoint, baseUrl).toString();
}
function buildProviderHeaders() {
    const authCode = normalizeText(process.env.IPAY_AUTH_CODE);
    const clientId = normalizeText(process.env.IPAY_CLIENT_ID);
    const clientSecret = normalizeText(process.env.IPAY_CLIENT_SECRET);
    const endpointIp = normalizeText(process.env.IPAY_ENDPOINT_IP);
    if (!authCode || !clientId || !clientSecret || !endpointIp) {
        throw new Error('Bank verification API credentials are not configured');
    }
    return {
        'Content-Type': 'application/json',
        'X-Ipay-Auth-Code': authCode,
        'X-Ipay-Client-Id': clientId,
        'X-Ipay-Client-Secret': clientSecret,
        'X-Ipay-Endpoint-Ip': endpointIp,
    };
}
async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal,
        });
    }
    finally {
        clearTimeout(timeout);
    }
}
async function getOrCreateFeeRecord(tx = prisma_1.default) {
    await ensureBankVerificationSchema();
    return tx.bankVerificationFee.upsert({
        where: { id: BANK_VERIFICATION_FEE_ID },
        create: {
            id: BANK_VERIFICATION_FEE_ID,
            amount: new client_1.Prisma.Decimal(0),
        },
        update: {},
    });
}
async function getPrimaryAdmin(tx = prisma_1.default) {
    const admin = await tx.user.findFirst({
        where: { role: 'ADMIN' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, email: true },
    });
    if (!admin) {
        throw new Error('No admin user found to receive bank verification fee');
    }
    return admin;
}
function extractStatusCode(payload) {
    return String(payload?.statuscode ??
        payload?.statusCode ??
        payload?.data?.statuscode ??
        payload?.data?.statusCode ??
        '').trim();
}
function extractProviderReference(payload, fallback) {
    return String(payload?.referenceId ??
        payload?.refId ??
        payload?.txnId ??
        payload?.transactionId ??
        payload?.data?.referenceId ??
        payload?.data?.refId ??
        payload?.data?.txnId ??
        fallback).trim();
}
async function createVerificationRequest(tx, args) {
    return tx.serviceRequest.create({
        data: {
            userId: args.userId,
            serviceType: 'BANK_VERIFICATION',
            amount: args.feeAmount,
            chargeAmount: args.feeAmount,
            bankName: args.input.bankName,
            accountName: args.input.accountName,
            accountNumber: args.input.accountNumber,
            ifscCode: args.input.ifscCode,
            status: args.status,
            remark: args.remark,
            paymentMode: 'BANK_VERIFICATION',
            paymentDate: new Date(),
            bankRef: args.providerReference ?? null,
            receiptPath: null,
        },
    });
}
async function getBankVerificationFee() {
    try {
        return await getOrCreateFeeRecord();
    }
    catch {
        const fallbackAmount = await readLocalBankVerificationFee();
        return {
            id: BANK_VERIFICATION_FEE_ID,
            amount: fallbackAmount || new client_1.Prisma.Decimal(0),
        };
    }
}
async function updateBankVerificationFee(amount) {
    const normalized = toDecimal(amount);
    try {
        await ensureBankVerificationSchema();
        return await prisma_1.default.bankVerificationFee.upsert({
            where: { id: BANK_VERIFICATION_FEE_ID },
            create: { id: BANK_VERIFICATION_FEE_ID, amount: normalized },
            update: { amount: normalized },
        });
    }
    catch (error) {
        await writeLocalBankVerificationFee(normalized);
        return {
            id: BANK_VERIFICATION_FEE_ID,
            amount: normalized,
            source: 'local-file',
            warning: error instanceof Error ? error.message : 'Saved locally',
        };
    }
}
async function listSavedBeneficiaries(userId) {
    await ensureBankVerificationSchema();
    return prisma_1.default.payoutBeneficiary.findMany({
        where: { userId, isVerified: true },
        orderBy: [{ verifiedAt: 'desc' }, { createdAt: 'desc' }],
    });
}
async function verifyBankBeneficiary(userId, input) {
    await ensureBankVerificationSchema();
    const normalizedInput = {
        bankName: normalizeText(input.bankName),
        accountName: normalizeText(input.accountName),
        accountNumber: normalizeAccountNumber(input.accountNumber),
        ifscCode: normalizeIfsc(input.ifscCode),
    };
    if (!normalizedInput.bankName || !normalizedInput.accountName || !normalizedInput.accountNumber || !normalizedInput.ifscCode) {
        const error = new Error('All bank verification fields are required');
        error.statusCode = 400;
        throw error;
    }
    const feeRecord = await getBankVerificationFee();
    const feeAmount = toDecimal(feeRecord.amount);
    const feeValue = Number(feeAmount);
    const cachedBeneficiary = await prisma_1.default.payoutBeneficiary.findFirst({
        where: {
            userId,
            accountNo: normalizedInput.accountNumber,
            bankIfsc: normalizedInput.ifscCode,
            isVerified: true,
        },
        orderBy: [{ verifiedAt: 'desc' }, { createdAt: 'desc' }],
    });
    if (cachedBeneficiary) {
        return {
            success: true,
            cached: true,
            message: 'Bank account already verified',
            fee: 0,
            beneficiary: cachedBeneficiary,
        };
    }
    const wallet = await prisma_1.default.wallet.findUnique({ where: { userId } });
    if (!wallet) {
        const error = new Error('Wallet not found');
        error.statusCode = 404;
        throw error;
    }
    const availableBalance = Number(wallet.balance) - Number(wallet.minimumHold || 0);
    if (availableBalance < feeValue) {
        const error = new Error(`Insufficient balance. Available: ₹${availableBalance.toFixed(2)} (Hold: ₹${Number(wallet.minimumHold || 0).toFixed(2)})`);
        error.statusCode = 400;
        throw error;
    }
    const url = buildProviderUrl();
    const timeoutMs = Number(process.env.IPAY_TIMEOUT_MS || Number(process.env.IPAY_TIMEOUT || 60) * 1000 || 60000);
    const payload = {
        payee: {
            name: normalizedInput.accountName,
            accountNumber: normalizedInput.accountNumber,
            bankIfsc: normalizedInput.ifscCode,
        },
        externalRef: (0, crypto_1.randomUUID)(),
        consent: 'Y',
        pennyDrop: 'Y',
        latitude: normalizeText(process.env.IPAY_LATITUDE) || '0',
        longitude: normalizeText(process.env.IPAY_LONGITUDE) || '0',
    };
    console.info('[BankVerification] request', JSON.stringify({
        url,
        userId,
        fee: feeValue,
        payload: redactProviderObject(payload),
    }));
    let responsePayload = {};
    try {
        const response = await fetchWithTimeout(url, {
            method: 'POST',
            headers: buildProviderHeaders(),
            body: JSON.stringify(payload),
        }, timeoutMs);
        const responseText = await response.text();
        try {
            responsePayload = responseText ? JSON.parse(responseText) : {};
        }
        catch {
            responsePayload = { raw: responseText };
        }
    }
    catch (error) {
        console.error('[BankVerification] provider_error', JSON.stringify({
            userId,
            fee: feeValue,
            payload: redactProviderObject(payload),
            error: error instanceof Error ? error.message : String(error),
        }));
        const failureRequest = await prisma_1.default.serviceRequest.create({
            data: {
                userId,
                serviceType: 'BANK_VERIFICATION',
                amount: feeAmount,
                chargeAmount: feeAmount,
                bankName: normalizedInput.bankName,
                accountName: normalizedInput.accountName,
                accountNumber: normalizedInput.accountNumber,
                ifscCode: normalizedInput.ifscCode,
                status: 'FAILED',
                remark: error instanceof Error ? error.message : 'Bank verification provider error',
                paymentMode: 'BANK_VERIFICATION',
                paymentDate: new Date(),
            },
        });
        return {
            success: false,
            cached: false,
            message: 'Bank verification failed',
            fee: feeValue,
            request: failureRequest,
        };
    }
    const statusCode = extractStatusCode(responsePayload);
    console.info('[BankVerification] response', JSON.stringify({
        userId,
        fee: feeValue,
        statusCode,
        response: redactProviderObject(responsePayload),
    }));
    if (statusCode !== 'TXN') {
        const failureRequest = await prisma_1.default.serviceRequest.create({
            data: {
                userId,
                serviceType: 'BANK_VERIFICATION',
                amount: feeAmount,
                chargeAmount: feeAmount,
                bankName: normalizedInput.bankName,
                accountName: normalizedInput.accountName,
                accountNumber: normalizedInput.accountNumber,
                ifscCode: normalizedInput.ifscCode,
                status: 'FAILED',
                remark: responsePayload?.message || responsePayload?.statusdesc || 'Verification rejected by provider',
                paymentMode: 'BANK_VERIFICATION',
                paymentDate: new Date(),
                bankRef: extractProviderReference(responsePayload, payload.externalRef),
            },
        });
        return {
            success: false,
            cached: false,
            message: responsePayload?.message || responsePayload?.statusdesc || 'Bank verification failed',
            fee: feeValue,
            request: failureRequest,
            providerResponse: responsePayload,
        };
    }
    const providerReference = extractProviderReference(responsePayload, payload.externalRef);
    const result = await prisma_1.default.$transaction(async (tx) => {
        const admin = await getPrimaryAdmin(tx);
        const beneficiary = await tx.payoutBeneficiary.upsert({
            where: {
                userId_accountNo_bankIfsc: {
                    userId,
                    accountNo: normalizedInput.accountNumber,
                    bankIfsc: normalizedInput.ifscCode,
                },
            },
            create: {
                userId,
                payeeName: normalizedInput.accountName,
                accountNo: normalizedInput.accountNumber,
                bankIfsc: normalizedInput.ifscCode,
                bankName: normalizedInput.bankName,
                isVerified: true,
                verifiedAt: new Date(),
                providerRef: providerReference,
                providerStatusCode: statusCode,
                providerResponse: JSON.stringify(redactProviderObject(responsePayload)),
            },
            update: {
                payeeName: normalizedInput.accountName,
                bankName: normalizedInput.bankName,
                isVerified: true,
                verifiedAt: new Date(),
                providerRef: providerReference,
                providerStatusCode: statusCode,
                providerResponse: JSON.stringify(redactProviderObject(responsePayload)),
            },
        });
        const requestRecord = await createVerificationRequest(tx, {
            userId,
            feeAmount,
            input: normalizedInput,
            status: 'SUCCESS',
            remark: responsePayload?.message || responsePayload?.statusdesc || 'Bank account verified successfully',
            providerReference,
        });
        const updatedUserWallet = await tx.wallet.update({
            where: { userId },
            data: { balance: { decrement: feeAmount } },
        });
        await tx.walletTransaction.create({
            data: {
                amount: feeAmount,
                type: 'DEBIT',
                description: 'Bank verification charge',
                senderId: userId,
                receiverId: userId,
                senderBalAfter: updatedUserWallet.balance,
                receiverBalAfter: updatedUserWallet.balance,
                serviceRequestId: requestRecord.id,
            },
        });
        const updatedAdminWallet = await tx.wallet.upsert({
            where: { userId: admin.id },
            create: { userId: admin.id, balance: feeAmount },
            update: { balance: { increment: feeAmount } },
        });
        await tx.walletTransaction.create({
            data: {
                amount: feeAmount,
                type: 'CREDIT',
                description: 'Bank verification fee credited',
                senderId: null,
                receiverId: admin.id,
                receiverBalAfter: updatedAdminWallet.balance,
                serviceRequestId: requestRecord.id,
            },
        });
        return { beneficiary, requestRecord };
    });
    return {
        success: true,
        cached: false,
        message: 'Bank verified successfully',
        fee: feeValue,
        beneficiary: result.beneficiary,
        request: result.requestRecord,
        providerResponse: responsePayload,
    };
}
