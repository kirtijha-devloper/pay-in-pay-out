import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { Role } from '@prisma/client';

// who can create which roles
const CREATION_PERMISSIONS: Record<string, Role[]> = {
  ADMIN: ['SUPER', 'DISTRIBUTOR', 'RETAILER'],
  SUPER: ['DISTRIBUTOR', 'RETAILER'],
  DISTRIBUTOR: ['RETAILER'],
};

export const createUser = async (req: AuthRequest, res: Response) => {
  const {
    email, password, role,
    ownerName, shopName, mobileNumber,
    fullAddress, state, pinCode, aadhaarNumber,
  } = req.body;
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  const creatorRole = req.user!.role;
  const allowed = CREATION_PERMISSIONS[creatorRole] || [];
  if (!allowed.includes(role as Role)) {
    res.status(403).json({ success: false, message: `${creatorRole} cannot create ${role}` });
    return;
  }

  try {
    const exists = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
    });
    if (exists) {
      res.status(409).json({ success: false, message: 'Email already exists' });
      return;
    }
    const mobileExists = await prisma.profile.findUnique({ where: { mobileNumber } });
    if (mobileExists) {
      res.status(409).json({ success: false, message: 'Mobile number already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role: role as Role,
        parentId: req.user!.id,
        profile: {
          create: {
            ownerName,
            shopName,
            mobileNumber,
            fullAddress,
            state,
            pinCode,
            aadhaarNumber,
            aadhaarFrontPath: files?.['aadhaarFront']?.[0]?.path,
            aadhaarBackPath: files?.['aadhaarBack']?.[0]?.path,
            panCardPath: files?.['panCard']?.[0]?.path,
          },
        },
        wallet: { create: {} },
      },
      include: { profile: true, wallet: true },
    });

    res.status(201).json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getUsers = async (req: AuthRequest, res: Response) => {
  const filterRole = req.query.role as string | undefined;
  const status = req.query.status as string | undefined;
  const page = (req.query.page as string) || '1';
  const limit = (req.query.limit as string) || '20';
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  // Build hierarchy filter — all downline of current user
  const where: any = { parentId: req.user!.id };
  if (filterRole) where.role = filterRole;
  if (status === 'active') where.isActive = true;
  if (status === 'inactive') where.isActive = false;

  // Admin sees all
  if (req.user!.role === 'ADMIN') delete where.parentId;

  try {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        include: { profile: true, wallet: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ success: true, users, total, page: parseInt(page), limit: take });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getUserById = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id as string },
      include: {
        profile: true,
        wallet: true,
        children: { include: { profile: true, wallet: true } },
      },
    });
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const toggleUserStatus = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id as string } });
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    const updated = await prisma.user.update({
      where: { id: req.params.id as string },
      data: { isActive: !user.isActive },
    });
    res.json({ success: true, isActive: updated.isActive });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  const { ownerName, shopName, mobileNumber, fullAddress, state, pinCode } = req.body;
  try {
    const profile = await prisma.profile.update({
      where: { userId: req.params.id as string },
      data: { ownerName, shopName, mobileNumber, fullAddress, state, pinCode },
    });
    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    // soft delete
    await prisma.user.update({
      where: { id: req.params.id as string },
      data: { isActive: false },
    });
    res.json({ success: true, message: 'User deactivated (soft deleted)' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  const { ownerName, shopName, fullAddress, state, pinCode } = req.body;
  try {
    const profile = await prisma.profile.update({
      where: { userId: req.user!.id },
      data: { ownerName, shopName, fullAddress, state, pinCode },
    });
    res.json({ success: true, profile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
