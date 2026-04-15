import { Prisma, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import {
  canManageTarget,
  decorateUserWithHierarchy,
  decorateUsersWithHierarchy,
  fetchHierarchyUsers,
  getDescendantIds,
} from '../services/userHierarchy.service';

const CREATION_PERMISSIONS: Record<string, Role[]> = {
  ADMIN: ['SUPER', 'DISTRIBUTOR', 'RETAILER'],
  SUPER: ['DISTRIBUTOR', 'RETAILER'],
  DISTRIBUTOR: ['RETAILER'],
};

const sanitizeUser = (user: any) => {
  const { passwordHash, children, ...safeUser } = user;

  if (!children) {
    return safeUser;
  }

  return {
    ...safeUser,
    children: children.map(sanitizeUser),
  };
};

export const createUser = async (req: AuthRequest, res: Response) => {
  const {
    email,
    password,
    role,
    ownerName,
    shopName,
    mobileNumber,
    fullAddress,
    state,
    pinCode,
    aadhaarNumber,
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
            aadhaarFrontPath: files?.aadhaarFront?.[0]?.path,
            aadhaarBackPath: files?.aadhaarBack?.[0]?.path,
            panCardPath: files?.panCard?.[0]?.path,
          },
        },
        wallet: { create: {} },
      },
      include: { profile: true, wallet: true },
    });

    const hierarchyUsers = await fetchHierarchyUsers();

    res.status(201).json({
      success: true,
      user: sanitizeUser(decorateUserWithHierarchy(user, hierarchyUsers)),
    });
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
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const take = parseInt(limit, 10);

  try {
    const hierarchyUsers = await fetchHierarchyUsers();
    const visibleUserIds = getDescendantIds(req.user!.id, hierarchyUsers);

    if (visibleUserIds.length === 0) {
      res.json({ success: true, users: [], total: 0, page: parseInt(page, 10), limit: take });
      return;
    }

    const where: Prisma.UserWhereInput = {
      id: { in: visibleUserIds },
    };

    if (filterRole) where.role = filterRole as Role;
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;

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

    res.json({
      success: true,
      users: decorateUsersWithHierarchy(users, hierarchyUsers).map(sanitizeUser),
      total,
      page: parseInt(page, 10),
      limit: take,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getUserById = async (req: AuthRequest, res: Response) => {
  try {
    const hierarchyUsers = await fetchHierarchyUsers();
    const targetUserId = req.params.id as string;
    const targetExists = hierarchyUsers.some((user) => user.id === targetUserId);

    if (!targetExists) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (!canManageTarget(req.user!, targetUserId, hierarchyUsers)) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        profile: true,
        wallet: true,
        children: { include: { profile: true, wallet: true } },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({
      success: true,
      user: sanitizeUser(decorateUserWithHierarchy(user, hierarchyUsers)),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const toggleUserStatus = async (req: AuthRequest, res: Response) => {
  try {
    const hierarchyUsers = await fetchHierarchyUsers();
    const targetUserId = req.params.id as string;
    const targetExists = hierarchyUsers.some((user) => user.id === targetUserId);

    if (!targetExists) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (!canManageTarget(req.user!, targetUserId, hierarchyUsers)) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { isActive: !user.isActive },
    });

    res.json({ success: true, isActive: updated.isActive });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  const { ownerName, shopName, mobileNumber, fullAddress, state, pinCode, aadhaarNumber } = req.body;

  try {
    const hierarchyUsers = await fetchHierarchyUsers();
    const targetUserId = req.params.id as string;
    const targetExists = hierarchyUsers.some((user) => user.id === targetUserId);

    if (!targetExists) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (!canManageTarget(req.user!, targetUserId, hierarchyUsers)) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { profile: true, wallet: true },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const mobileExists = await prisma.profile.findFirst({
      where: {
        mobileNumber,
        userId: { not: targetUserId },
      },
    });

    if (mobileExists) {
      res.status(409).json({ success: false, message: 'Mobile number already exists' });
      return;
    }

    const profile = await prisma.profile.update({
      where: { userId: targetUserId },
      data: { ownerName, shopName, mobileNumber, fullAddress, state, pinCode, aadhaarNumber },
    });

    res.json({
      success: true,
      user: sanitizeUser(
        decorateUserWithHierarchy(
          {
            ...user,
            profile,
          },
          hierarchyUsers
        )
      ),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
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
