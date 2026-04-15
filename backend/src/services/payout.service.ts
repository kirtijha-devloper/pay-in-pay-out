import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import prisma from '../lib/prisma';
import {
  buildChargeDistribution,
  resolveCharge,
  toDecimalAmount,
  ChargeDistributionEntry,
} from './commission.service';
import {
  checkBranchxPayoutStatus,
  normalizeBranchxStatus,
  submitBranchxPayout,
} from './branchx.service';

type PayoutSubmissionInput = {
  beneficiaryId: string;
  amount: number | string;
  tpin: string;
  confirmVerified?: boolean | string;
  remark?: string;
  transferMode?: string;
};

type PayoutQuote = {
  amount: number;
  charge: number;
  netAmount: number;
  walletRequired: number;
};

type FinalizeOutcome = 'SUCCESS' | 'FAILED';

function createHttpError(message: string, statusCode: number) {
  const error = new Error(message);
  (error as any).statusCode = statusCode;
  return error;
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = normalizeText(value).toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(text);
}

function buildRequestId() {
  return `BXP-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function parseChargeDistribution(raw: string | null): ChargeDistributionEntry[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as ChargeDistributionEntry[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => item && typeof item.receiverId === 'string' && Number(item.amount || 0) > 0)
      .map((item) => ({
        receiverId: item.receiverId,
        amount: Number(item.amount || 0),
      }));
  } catch {
    return [];
  }
}

async function getUserWithWalletAndProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      wallet: true,
    },
  });
}

async function getVerifiedBeneficiary(userId: string, beneficiaryId: string) {
  return prisma.payoutBeneficiary.findFirst({
    where: {
      id: beneficiaryId,
      userId,
      isVerified: true,
    },
  });
}

async function verifyTransactionPin(user: { transactionPinHash: string | null }, tpin: string) {
  if (!user.transactionPinHash) {
    throw createHttpError('Transaction PIN is not set for this account', 400);
  }

  const suppliedPin = normalizeText(tpin);
  if (!suppliedPin) {
    throw createHttpError('Transaction PIN is required', 400);
  }

  const matches = await bcrypt.compare(suppliedPin, user.transactionPinHash);
  if (!matches) {
    throw createHttpError('Invalid Transaction PIN', 400);
  }
}

export async function getPayoutQuote(userId: string, amountInput: number | string): Promise<PayoutQuote> {
  const normalizedAmount = Number(amountInput);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw createHttpError('Payout amount must be greater than zero', 400);
  }

  const amount = toDecimalAmount(normalizedAmount);
  if (amount.lte(0)) {
    throw createHttpError('Payout amount must be greater than zero', 400);
  }

  const charge = toDecimalAmount(await resolveCharge(userId, 'PAYOUT', amount.toNumber()));
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

async function reservePayoutRequest(
  userId: string,
  beneficiary: NonNullable<Awaited<ReturnType<typeof getVerifiedBeneficiary>>>,
  quote: PayoutQuote,
  input: PayoutSubmissionInput,
  chargeDistribution: ChargeDistributionEntry[],
  requestId: string
) {
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet || Number(wallet.balance) < quote.walletRequired) {
      throw createHttpError(`Insufficient balance. Required: ₹${quote.walletRequired.toFixed(2)}`, 400);
    }

    const updatedWallet = await tx.wallet.update({
      where: { userId },
      data: { balance: { decrement: quote.walletRequired } },
    });

    const request = await tx.serviceRequest.create({
      data: {
        userId,
        serviceType: 'PAYOUT',
        amount: new Prisma.Decimal(quote.amount),
        chargeAmount: new Prisma.Decimal(quote.charge),
        creditedAmount: new Prisma.Decimal(quote.netAmount),
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
        amount: new Prisma.Decimal(quote.amount),
        type: 'DEBIT',
        status: 'PENDING',
        description: 'Payout reserved',
        senderId: userId,
        receiverId: userId,
        senderBalAfter: updatedWallet.balance,
        receiverBalAfter: updatedWallet.balance,
        serviceRequestId: request.id,
      },
    });

    return request;
  });
}

async function creditCommissionShares(
  tx: any,
  requestUserId: string,
  grossAmount: Prisma.Decimal,
  serviceRequestId: string,
  chargeDistribution: ChargeDistributionEntry[]
) {
  let shares = chargeDistribution;

  if (!shares.length) {
    shares = await buildChargeDistribution(requestUserId, 'PAYOUT', grossAmount);
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
        description: 'Payout commission',
        senderId: requestUserId,
        receiverId: share.receiverId,
        receiverBalAfter: updatedWallet.balance,
        serviceRequestId,
      },
    });
  }
}

export async function finalizePayoutSettlement(
  requestId: string,
  outcome: FinalizeOutcome,
  providerResponse?: any,
  settlementSource = 'CRON'
) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.serviceRequest.findUnique({
      where: { id: requestId },
      include: {
        walletTransactions: true,
      },
    });

    if (!request || request.serviceType !== 'PAYOUT' || request.status !== 'PENDING') {
      return { skipped: true, request };
    }

    const grossAmount = toDecimalAmount(request.amount || 0);
    const chargeAmount = toDecimalAmount(request.chargeAmount || 0);
    const netAmount = toDecimalAmount(request.creditedAmount || grossAmount.minus(chargeAmount));
    const debitTransaction = request.walletTransactions.find(
      (transaction) => transaction.type === 'DEBIT' && transaction.status === 'PENDING'
    );
    const chargeDistribution = parseChargeDistribution(request.chargeDistribution);

    const updated = await tx.serviceRequest.updateMany({
      where: { id: requestId, status: 'PENDING' },
      data: {
        status: outcome,
        remark:
          outcome === 'FAILED'
            ? normalizeText(request.remark) || normalizeText(providerResponse?.message) || 'Payout failed'
            : request.remark,
      },
    });

    if (updated.count === 0) {
      return { skipped: true, request };
    }

    if (debitTransaction) {
      await tx.walletTransaction.updateMany({
        where: { id: debitTransaction.id, status: 'PENDING' },
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
        amount: grossAmount,
        type: 'CREDIT',
        status: 'SUCCESS',
        description: 'Payout refund',
        senderId: null,
        receiverId: request.userId,
        receiverBalAfter: refundedWallet.balance,
        serviceRequestId: request.id,
      },
    });

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

export async function submitPayoutRequest(userId: string, input: PayoutSubmissionInput) {
  const user = await getUserWithWalletAndProfile(userId);
  if (!user) {
    throw createHttpError('User not found', 404);
  }

  if (!normalizeBoolean(input.confirmVerified)) {
    throw createHttpError('Please confirm that the beneficiary has been verified', 400);
  }

  await verifyTransactionPin(user as any, input.tpin);

  const beneficiaryId = normalizeText(input.beneficiaryId);
  if (!beneficiaryId) {
    throw createHttpError('Please select a verified beneficiary', 400);
  }

  const beneficiary = await getVerifiedBeneficiary(userId, beneficiaryId);
  if (!beneficiary) {
    throw createHttpError('Selected beneficiary is not verified or does not belong to this account', 400);
  }

  const quote = await getPayoutQuote(userId, input.amount);
  const amount = toDecimalAmount(quote.amount);
  const mobileNumber = normalizeText(user.profile?.mobileNumber);
  if (!mobileNumber) {
    throw createHttpError('Mobile number is required for BranchX payout', 400);
  }

  const chargeDistribution = await buildChargeDistribution(userId, 'PAYOUT', amount);
  const requestId = buildRequestId();
  const pendingRequest = await reservePayoutRequest(userId, beneficiary, quote, input, chargeDistribution, requestId);

  try {
    const providerResponse = await submitBranchxPayout({
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

    if (providerResponse.status === 'SUCCESS') {
      const finalResult = await finalizePayoutSettlement(pendingRequest.id, 'SUCCESS', providerResponse.raw, 'BRANCHX_INIT');
      return {
        success: true,
        status: 'SUCCESS',
        message: 'Payout request processed successfully',
        requestId,
        request: pendingRequest,
        charge: quote.charge,
        netAmount: quote.netAmount,
        providerResponse: providerResponse.raw,
        settlement: finalResult,
      };
    }

    if (providerResponse.status === 'FAILED') {
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

    return {
      success: true,
      status: 'PENDING',
      message: 'Payout request submitted and is pending',
      requestId,
      request: pendingRequest,
      charge: quote.charge,
      netAmount: quote.netAmount,
      providerResponse: providerResponse.raw,
    };
  } catch (error) {
    const settled = await finalizePayoutSettlement(
      pendingRequest.id,
      'FAILED',
      error instanceof Error ? { message: error.message } : { message: 'BranchX payout request failed' },
      'BRANCHX_INIT_ERROR'
    );

    const statusCode = (error as any)?.statusCode || 502;
    const message =
      error instanceof Error ? error.message : 'BranchX payout request failed and the reserved amount was refunded';

    const wrappedError = new Error(message);
    (wrappedError as any).statusCode = statusCode;
    (wrappedError as any).requestId = requestId;
    (wrappedError as any).settlement = settled;
    throw wrappedError;
  }
}

export async function syncPendingPayouts() {
  const pendingRequests = await prisma.serviceRequest.findMany({
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
      const statusResponse = await checkBranchxPayoutStatus(request.bankRef as string);
      const normalizedStatus = normalizeBranchxStatus(statusResponse.raw);

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
    } catch (error) {
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
