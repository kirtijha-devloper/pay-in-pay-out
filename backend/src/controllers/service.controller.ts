import { Prisma } from '@prisma/client';
import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { buildChargeDistribution, resolveCharge } from '../services/commission.service';

function toNumberAmount(value: Prisma.Decimal | string | number | null | undefined) {
  return Number(value || 0);
}

async function creditWallet(
  tx: any,
  userId: string,
  amount: number,
  description: string,
  senderId: string | null,
  serviceRequestId: string
) {
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

async function distributeFundRequestCharge(
  tx: any,
  requestUserId: string,
  amount: Prisma.Decimal | string | number,
  serviceRequestId: string
) {
  const shares = await buildChargeDistribution(requestUserId, 'FUND_REQUEST', amount);

  for (const share of shares) {
    await creditWallet(
      tx,
      share.receiverId,
      share.amount,
      'Fund request commission',
      requestUserId,
      serviceRequestId
    );
  }
}

export const getCompanyBankAccounts = async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.user!.role === 'ADMIN';
    const accounts = await prisma.companyBankAccount.findMany({
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const upsertCompanyBankAccount = async (req: AuthRequest, res: Response) => {
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

    const payload = {
      bankName: normalizedBankName,
      accountNumber: normalizedAccountNumber,
      ifscCode: normalizedIfscCode,
      isActive: normalizedIsActive,
      updatedById: req.user!.id,
    };

    const account = id
      ? await prisma.companyBankAccount.update({
          where: { id },
          data: payload,
        })
      : await prisma.companyBankAccount.create({
          data: {
            ...payload,
            createdById: req.user!.id,
          },
        });

    res.json({ success: true, account });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const toggleCompanyBankAccount = async (req: AuthRequest, res: Response) => {
  try {
    const accountId = String(req.params.id);
    const account = await prisma.companyBankAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      res.status(404).json({ success: false, message: 'Bank account not found' });
      return;
    }

    const updated = await prisma.companyBankAccount.update({
      where: { id: account.id },
      data: {
        isActive: !account.isActive,
        updatedById: req.user!.id,
      },
    });

    res.json({ success: true, account: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const submitFundRequest = async (req: AuthRequest, res: Response) => {
  const { amount, bankRef, paymentDate, paymentMode, remark, bankAccountId } = req.body;
  const receiptFile = (req as any).file as Express.Multer.File | undefined;

  try {
    if (!bankAccountId) {
      res.status(400).json({ success: false, message: 'Please select a company bank account' });
      return;
    }

    if (!receiptFile) {
      res.status(400).json({ success: false, message: 'Please upload a receipt image or PDF' });
      return;
    }

    const account = await prisma.companyBankAccount.findUnique({ where: { id: bankAccountId } });
    if (!account || !account.isActive) {
      res.status(400).json({ success: false, message: 'Selected bank account is not available' });
      return;
    }

    const request = await prisma.serviceRequest.create({
      data: {
        userId: req.user!.id,
        serviceType: 'FUND_REQUEST',
        amount: new Prisma.Decimal(amount),
        bankRef,
        paymentDate: paymentDate ? new Date(paymentDate) : undefined,
        paymentMode,
        remark,
        receiptPath: receiptFile.path,
        companyBankAccountId: bankAccountId,
        status: 'PENDING',
      },
    });
    res.status(201).json({ success: true, request });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const approveFundRequest = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const request = await prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        companyBankAccount: true,
      },
    });
    if (!request || request.status !== 'PENDING') {
      res.status(400).json({ success: false, message: 'Invalid request' });
      return;
    }

    const grossAmount = new Prisma.Decimal(request.amount || 0);
    if (grossAmount.lte(0)) {
      res.status(400).json({ success: false, message: 'Request amount must be greater than zero' });
      return;
    }

    const charge = new Prisma.Decimal(await resolveCharge(request.userId, 'FUND_REQUEST', toNumberAmount(request.amount)));
    const creditedAmount = grossAmount.minus(charge).toDecimalPlaces(2);

    if (creditedAmount.lte(0)) {
      res.status(400).json({ success: false, message: 'Resolved charge cannot exceed the request amount' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.serviceRequest.update({
        where: { id },
        data: {
          status: 'SUCCESS',
          approvedById: req.user!.id,
          approvedAt: new Date(),
          chargeAmount: charge,
          creditedAmount,
        },
      });

      await creditWallet(
        tx,
        request.userId,
        creditedAmount.toNumber(),
        'Wallet top-up approved',
        request.userId,
        id
      );

      await distributeFundRequestCharge(tx, request.userId, grossAmount, id);
    });

    res.json({
      success: true,
      message: 'Fund request approved and wallet credited',
      charge: charge.toNumber(),
      creditedAmount: creditedAmount.toNumber(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const rejectFundRequest = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    await prisma.serviceRequest.update({
      where: { id },
      data: {
        status: 'FAILED',
        rejectedById: req.user!.id,
        rejectedAt: new Date(),
      },
    });
    res.json({ success: true, message: 'Fund request rejected' });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const verifyBank = async (req: AuthRequest, res: Response) => {
  const { bankName, accountName, accountNumber, ifscCode } = req.body;
  const userId = req.user!.id;

  try {
    const charge = await resolveCharge(userId, 'BANK_VERIFICATION', 0);
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || Number(wallet.balance) < charge) {
      res.status(400).json({ success: false, message: `Insufficient balance. Charge: ₹${charge}` });
      return;
    }

    await prisma.$transaction([
      prisma.wallet.update({ where: { userId }, data: { balance: { decrement: charge } } }),
      prisma.serviceRequest.create({
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

    const shares = await buildChargeDistribution(userId, 'BANK_VERIFICATION', charge);
    for (const share of shares) {
      const updatedWallet = await prisma.wallet.upsert({
        where: { userId: share.receiverId },
        create: { userId: share.receiverId, balance: share.amount },
        update: { balance: { increment: share.amount } },
      });

      await prisma.walletTransaction.create({
        data: {
          amount: share.amount,
          type: 'CREDIT',
          description: 'Bank verification commission',
          senderId: userId,
          receiverId: share.receiverId,
          receiverBalAfter: updatedWallet.balance,
        },
      });
    }

    res.json({ success: true, message: 'Bank verified successfully', charge });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const submitPayout = async (req: AuthRequest, res: Response) => {
  const { amount, bankName, accountName, accountNumber, ifscCode, remark } = req.body;
  const userId = req.user!.id;

  try {
    const charge = await resolveCharge(userId, 'PAYOUT', amount);
    const total = amount + charge;
    const wallet = await prisma.wallet.findUnique({ where: { userId } });

    if (!wallet || Number(wallet.balance) < total) {
      res.status(400).json({ success: false, message: `Insufficient balance. Required: ₹${total}` });
      return;
    }

    await prisma.$transaction([
      prisma.wallet.update({ where: { userId }, data: { balance: { decrement: total } } }),
      prisma.serviceRequest.create({
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

    const shares = await buildChargeDistribution(userId, 'PAYOUT', amount);
    for (const share of shares) {
      const updatedWallet = await prisma.wallet.upsert({
        where: { userId: share.receiverId },
        create: { userId: share.receiverId, balance: share.amount },
        update: { balance: { increment: share.amount } },
      });

      await prisma.walletTransaction.create({
        data: {
          amount: share.amount,
          type: 'CREDIT',
          description: 'Payout commission',
          senderId: userId,
          receiverId: share.receiverId,
          receiverBalAfter: updatedWallet.balance,
        },
      });
    }

    res.json({ success: true, message: 'Payout submitted for processing', charge });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getServiceRequests = async (req: AuthRequest, res: Response) => {
  const serviceType = req.query.serviceType as string | undefined;
  const status = req.query.status as string | undefined;
  const filterUserId = req.query.userId as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const page = (req.query.page as string) || '1';
  const limit = (req.query.limit as string) || '20';
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const where: any = {};
  if (serviceType) where.serviceType = serviceType;
  if (status) where.status = status;
  if (filterUserId) where.userId = filterUserId;
  if (req.user!.role !== 'ADMIN') where.userId = req.user!.id;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from as string);
    if (to) where.createdAt.lte = new Date(to as string);
  }

  try {
    const [requests, total] = await Promise.all([
      prisma.serviceRequest.findMany({
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
      prisma.serviceRequest.count({ where }),
    ]);
    res.json({ success: true, requests, total });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
