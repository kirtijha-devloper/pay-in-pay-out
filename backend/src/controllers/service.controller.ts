import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { Decimal } from '@prisma/client/runtime/library';

// Helper: get applicable commission for a role and amount
async function getCharge(
  userId: string,
  serviceType: string,
  amount: number
): Promise<number> {
  // Check user-specific override first
  const override = await prisma.userCommissionSetup.findFirst({
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
  const slab = await prisma.commissionSlab.findFirst({
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
async function distributeCommissions(userId: string, serviceType: string, amount: number) {
  let currentId: string | null = userId;
  let level = 0;

  while (currentId && level < 5) {
    const currentUser: { parentId: string | null } | null = await prisma.user.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });

    if (!currentUser || !currentUser.parentId) break;

    const parentId = currentUser.parentId;
    const commission = await getCharge(parentId, serviceType, amount);

    if (commission > 0) {
      const updatedWallet = await prisma.wallet.upsert({
        where: { userId: parentId },
        create: { userId: parentId, balance: commission },
        update: { balance: { increment: commission } },
      });

      await prisma.walletTransaction.create({
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

export const submitFundRequest = async (req: AuthRequest, res: Response) => {
  const { amount, bankRef, paymentDate, paymentMode, remark, bankAccountId } = req.body;
  try {
    const request = await prisma.serviceRequest.create({
      data: {
        userId: req.user!.id,
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const approveFundRequest = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const request = await prisma.serviceRequest.findUnique({ where: { id } });
    if (!request || request.status !== 'PENDING') {
      res.status(400).json({ success: false, message: 'Invalid request' });
      return;
    }
    const amt = Number(request.amount!);

    await prisma.$transaction([
      prisma.serviceRequest.update({ where: { id }, data: { status: 'SUCCESS' } }),
      prisma.wallet.upsert({
        where: { userId: request.userId },
        create: { userId: request.userId, balance: amt },
        update: { balance: { increment: amt } },
      }),
      prisma.walletTransaction.create({
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const rejectFundRequest = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    await prisma.serviceRequest.update({ where: { id }, data: { status: 'FAILED' } });
    res.json({ success: true, message: 'Fund request rejected' });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const verifyBank = async (req: AuthRequest, res: Response) => {
  const { bankName, accountName, accountNumber, ifscCode } = req.body;
  const userId = req.user!.id;

  try {
    const charge = await getCharge(userId, 'BANK_VERIFICATION', 0);
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

    await distributeCommissions(userId, 'BANK_VERIFICATION', charge);
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
    const charge = await getCharge(userId, 'PAYOUT', amount);
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

    await distributeCommissions(userId, 'PAYOUT', amount);
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
        include: { user: { include: { profile: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.serviceRequest.count({ where }),
    ]);
    res.json({ success: true, requests, total });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
