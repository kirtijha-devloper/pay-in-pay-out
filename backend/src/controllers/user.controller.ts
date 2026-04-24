import { KycStatus, Prisma, Role } from '@prisma/client';
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

const KYC_REQUEST_INCLUDE = {
  user: {
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      kycStatus: true,
      profile: {
        select: {
          ownerName: true,
          shopName: true,
          mobileNumber: true,
          aadhaarNumber: true,
        },
      },
    },
  },
  reviewedBy: {
    select: {
      id: true,
      email: true,
      role: true,
    },
  },
};

function normalizeKycStatus(status: unknown): KycStatus {
  const value = String(status || '').toUpperCase();
  if (value === 'VERIFIED') return KycStatus.VERIFIED;
  if (value === 'REJECTED') return KycStatus.REJECTED;
  return KycStatus.PENDING;
}

function serializeKycRequest(request: any) {
  if (!request) return null;

  let dateOfBirth = '';
  if (request.dateOfBirth) {
    const parsedDate = new Date(request.dateOfBirth);
    dateOfBirth = Number.isNaN(parsedDate.getTime())
      ? String(request.dateOfBirth)
      : parsedDate.toISOString().slice(0, 10);
  }

  return {
    ...request,
    dateOfBirth,
  };
}

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
        parentId: req.body.parentId || req.user!.id,
        profile: {
          create: {
            ownerName: ownerName || normalizedEmail.split('@')[0],
            shopName: shopName || `${normalizedEmail.split('@')[0]}'s Shop`,
            mobileNumber: mobileNumber || `0000${Math.floor(Math.random() * 1000000)}`, // Fallback for testing
            fullAddress: fullAddress || 'Address N/A',
            state: state || 'State N/A',
            pinCode: pinCode || '000000',
            aadhaarNumber: aadhaarNumber || null,
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
  const {
    ownerName,
    shopName,
    fullAddress,
    state,
    pinCode,
    bankName,
    accountNumber,
    accountName,
    ifscCode,
    tpin,
  } = req.body;

  try {
    const userId = req.user!.id;
    const isUpdatingBank = bankName || accountNumber || accountName || ifscCode;

    if (isUpdatingBank) {
      if (!tpin) {
        res.status(400).json({
          success: false,
          message: 'Transaction PIN is required to update bank details',
        });
        return;
      }

      const userExists = await prisma.user.findUnique({
        where: { id: userId },
        select: { transactionPinHash: true },
      });

      if (!userExists?.transactionPinHash) {
        res.status(400).json({
          success: false,
          message: 'Please set your Transaction PIN in security settings first',
        });
        return;
      }

      const validPin = await bcrypt.compare(String(tpin), userExists.transactionPinHash);
      if (!validPin) {
        res.status(400).json({ success: false, message: 'Invalid Transaction PIN' });
        return;
      }
    }

    const profile = await prisma.profile.update({
      where: { userId },
      data: {
        ownerName,
        shopName,
        fullAddress,
        state,
        pinCode,
        bankName,
        accountNumber,
        accountName,
        ifscCode,
      },
    });
    res.json({ success: true, profile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateKycStatus = async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  const targetUserId = req.params.id as string;

  if (req.user!.role !== 'ADMIN') {
    res.status(403).json({ success: false, message: 'Only admins can update KYC status' });
    return;
  }

  try {
    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { kycStatus: status },
    });

    res.json({ success: true, kycStatus: updated.kycStatus });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const submitKycRequest = async (req: AuthRequest, res: Response) => {
  const { fullName, dateOfBirth, gender, aadhaarNumber, panNumber } = req.body;
  const photoFile = (req as any).file as Express.Multer.File | undefined;

  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, kycStatus: true },
    });

    if (!currentUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (currentUser.kycStatus === KycStatus.VERIFIED) {
      res.status(409).json({ success: false, message: 'KYC is already verified' });
      return;
    }

    if (!fullName || !dateOfBirth || !gender || !aadhaarNumber || !panNumber) {
      res.status(400).json({
        success: false,
        message: 'Full name, date of birth, gender, Aadhaar number, and PAN number are required',
      });
      return;
    }

    const parsedDateOfBirth = new Date(dateOfBirth);
    if (Number.isNaN(parsedDateOfBirth.getTime())) {
      res.status(400).json({ success: false, message: 'Date of birth must be a valid date' });
      return;
    }

    const normalizedGender = String(gender).trim().toUpperCase();
    if (!['MALE', 'FEMALE', 'OTHER'].includes(normalizedGender)) {
      res.status(400).json({ success: false, message: 'Gender must be MALE, FEMALE, or OTHER' });
      return;
    }

    const existingPending = await prisma.kycRequest.findFirst({
      where: {
        userId: req.user!.id,
        status: KycStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingPending) {
      res.status(409).json({
        success: false,
        message: 'You already have a pending KYC request',
        request: serializeKycRequest(existingPending),
      });
      return;
    }

    const request = await prisma.$transaction(async (tx) => {
      const created = await tx.kycRequest.create({
        data: {
          userId: req.user!.id,
          fullName: String(fullName).trim(),
          dateOfBirth: parsedDateOfBirth,
          gender: normalizedGender,
          aadhaarNumber: String(aadhaarNumber).trim(),
          panNumber: String(panNumber).trim().toUpperCase(),
          kycPhotoPath: photoFile?.path,
          status: KycStatus.PENDING,
        },
        include: KYC_REQUEST_INCLUDE,
      });

      await tx.user.update({
        where: { id: req.user!.id },
        data: { kycStatus: KycStatus.PENDING },
      });

      return created;
    });

    res.status(201).json({
      success: true,
      message: 'KYC request submitted for admin review',
      request: serializeKycRequest(request),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getMyKycRequest = async (req: AuthRequest, res: Response) => {
  try {
    const requests = await prisma.kycRequest.findMany({
      where: { userId: req.user!.id },
      include: KYC_REQUEST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      requests: requests.map(serializeKycRequest),
      request: serializeKycRequest(requests[0] || null),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getKycRequests = async (req: AuthRequest, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const where: Prisma.KycRequestWhereInput = {};

    if (status) {
      where.status = normalizeKycStatus(status);
    }

    const requests = await prisma.kycRequest.findMany({
      where,
      include: KYC_REQUEST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      requests: requests.map(serializeKycRequest),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

async function reviewKycRequest(
  req: AuthRequest,
  res: Response,
  status: KycStatus
) {
  const id = req.params.id as string;
  const reviewRemark = String(req.body?.reviewRemark || req.body?.remark || '').trim();

  try {
    const request = await prisma.kycRequest.findUnique({
      where: { id },
      include: {
        user: { include: { profile: true } },
      },
    });

    if (!request) {
      res.status(404).json({ success: false, message: 'KYC request not found' });
      return;
    }

    if (request.status !== KycStatus.PENDING) {
      res.status(400).json({ success: false, message: 'This KYC request has already been reviewed' });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const savedRequest = await tx.kycRequest.update({
        where: { id },
        data: {
          status,
          reviewedById: req.user!.id,
          reviewedAt: new Date(),
          reviewRemark: reviewRemark || null,
        },
      });

      await tx.user.update({
        where: { id: request.userId },
        data: {
          kycStatus: status,
        },
      });

      if (status === KycStatus.VERIFIED) {
        await tx.profile.upsert({
          where: { userId: request.userId },
          create: {
            userId: request.userId,
            ownerName: request.fullName,
            shopName: request.user.profile?.shopName || request.fullName,
            mobileNumber: request.user.profile?.mobileNumber || request.user.email || request.userId,
            fullAddress: request.user.profile?.fullAddress || '-',
            state: request.user.profile?.state || '-',
            pinCode: request.user.profile?.pinCode || '-',
            aadhaarNumber: request.aadhaarNumber,
          },
          update: {
            ownerName: request.fullName,
            aadhaarNumber: request.aadhaarNumber,
          },
        });
      }

      return tx.kycRequest.findUnique({
        where: { id },
        include: KYC_REQUEST_INCLUDE,
      });
    });

    res.json({
      success: true,
      message: status === KycStatus.VERIFIED ? 'KYC approved' : 'KYC rejected',
      request: serializeKycRequest(updated),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

export const approveKycRequest = async (req: AuthRequest, res: Response) => {
  await reviewKycRequest(req, res, KycStatus.VERIFIED);
};

export const rejectKycRequest = async (req: AuthRequest, res: Response) => {
  await reviewKycRequest(req, res, KycStatus.REJECTED);
};

export const updateWalletHold = async (req: AuthRequest, res: Response) => {
  const { minimumHold } = req.body;
  const targetUserId = req.params.id as string;

  if (req.user!.role !== 'ADMIN') {
    res.status(403).json({ success: false, message: 'Only admins can set wallet hold' });
    return;
  }

  try {
    const updated = await prisma.wallet.update({
      where: { userId: targetUserId },
      data: { minimumHold: new Prisma.Decimal(minimumHold) },
    });

    res.json({ success: true, minimumHold: updated.minimumHold });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
