import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  const isAdmin = req.user!.role === 'ADMIN';
  try {
    const [totalUsers, totalBalance, totalTransactions, pendingRequests, recentTransactions] = await Promise.all([
      prisma.user.count({ where: isAdmin ? {} : { parentId: req.user!.id } }),
      prisma.wallet.aggregate({ _sum: { balance: true }, where: isAdmin ? {} : { userId: req.user!.id } }),
      prisma.serviceRequest.count({ where: isAdmin ? {} : { userId: req.user!.id } }),
      prisma.serviceRequest.count({ where: { status: 'PENDING', ...(isAdmin ? {} : { userId: req.user!.id }) } }),
      prisma.serviceRequest.findMany({
        where: isAdmin ? {} : { userId: req.user!.id },
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getLedger = async (req: AuthRequest, res: Response) => {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const page = (req.query.page as string) || '1';
  const limit = (req.query.limit as string) || '20';
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);
  const where: any = req.user!.role === 'ADMIN'
    ? {}
    : {
        OR: [
          { receiverId: req.user!.id },
          { senderId: req.user!.id },
        ],
      };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from as string);
    if (to) where.createdAt.lte = new Date(to as string);
  }
  try {
    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
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
      prisma.walletTransaction.count({ where }),
    ]);
    res.json({ success: true, transactions, total });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getReport = async (req: AuthRequest, res: Response) => {
  const type = req.query.type as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const filterUserId = req.query.userId as string | undefined;
  const page = (req.query.page as string) || '1';
  const limit = (req.query.limit as string) || '20';
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const where: any = {};
  if (filterUserId) where.userId = filterUserId;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from as string);
    if (to) where.createdAt.lte = new Date(to as string);
  }

  if (type === 'payout_pending') {
    where.serviceType = 'PAYOUT';
    where.status = 'PENDING';
  } else if (type === 'payout_history') {
    where.serviceType = 'PAYOUT';
  } else if (type === 'distributor') {
    const distributors = await prisma.user.findMany({
      where: { role: 'DISTRIBUTOR', parentId: req.user!.id },
      select: { id: true },
    });
    where.userId = { in: distributors.map((d) => d.id) };
  } else if (type === 'retailer') {
    const retailers = await prisma.user.findMany({
      where: { role: 'RETAILER', parentId: req.user!.id },
      select: { id: true },
    });
    where.userId = { in: retailers.map((r) => r.id) };
  }

  if (req.user!.role !== 'ADMIN' && !filterUserId && !where.userId) {
    where.userId = req.user!.id;
  }

  try {
    const [requests, total] = await Promise.all([
      prisma.serviceRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { user: { include: { profile: true } } },
      }),
      prisma.serviceRequest.count({ where }),
    ]);
    res.json({ success: true, requests, total });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
