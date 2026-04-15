import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { Role } from '@prisma/client';

export const getSlabs = async (req: AuthRequest, res: Response) => {
  try {
    const slabs = await prisma.commissionSlab.findMany({ orderBy: { minAmount: 'asc' } });
    res.json({ success: true, slabs });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const upsertSlab = async (req: AuthRequest, res: Response) => {
  const { id, serviceType, applyOnRole, commissionType, commissionValue, minAmount, maxAmount, isActive } = req.body;
  try {
    const slab = id
      ? await prisma.commissionSlab.update({
          where: { id },
          data: { serviceType, applyOnRole, commissionType, commissionValue, minAmount, maxAmount, isActive },
        })
      : await prisma.commissionSlab.create({
          data: { serviceType, applyOnRole: applyOnRole as Role, commissionType, commissionValue, minAmount, maxAmount, isActive },
        });
    res.json({ success: true, slab });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteSlab = async (req: AuthRequest, res: Response) => {
  try {
    await prisma.commissionSlab.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getUserOverrides = async (req: AuthRequest, res: Response) => {
  try {
    const overrides = await prisma.userCommissionSetup.findMany({
      where: { setById: req.user!.id },
      include: { targetUser: { include: { profile: true } } },
    });
    res.json({ success: true, overrides });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const setUserOverride = async (req: AuthRequest, res: Response) => {
  const { targetUserId, serviceType, commissionType, commissionValue, minAmount, maxAmount } = req.body;
  try {
    const override = await prisma.userCommissionSetup.upsert({
      where: { setById_targetUserId_serviceType: { setById: req.user!.id, targetUserId, serviceType } },
      create: { setById: req.user!.id, targetUserId, serviceType, commissionType, commissionValue, minAmount, maxAmount },
      update: { commissionType, commissionValue, minAmount, maxAmount },
    });
    res.json({ success: true, override });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
