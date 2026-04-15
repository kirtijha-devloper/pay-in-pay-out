import { Prisma, Role } from '@prisma/client';
import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { canManageTarget, fetchHierarchyUsers, getDescendantIds } from '../services/userHierarchy.service';
import {
  buildEffectiveSlabs,
  getAssignableRateRoles,
  isCommissionType,
  isRateServiceType,
  rangesOverlap,
  validateDefaultRateFloor,
  validateUserOverrideFloor,
  toDecimalAmount,
} from '../services/commission.service';

class InputValidationError extends Error {}

function getRangeKey(minAmount: Prisma.Decimal | string | number, maxAmount: Prisma.Decimal | string | number | null) {
  return `${toDecimalAmount(minAmount).toFixed(2)}|${maxAmount === null ? 'null' : toDecimalAmount(maxAmount).toFixed(2)}`;
}

function dedupeCommissionSlabs<T extends { id: string; serviceType: string; applyOnRole: Role; commissionType: string; commissionValue: Prisma.Decimal | string | number; minAmount: Prisma.Decimal | string | number; maxAmount: Prisma.Decimal | string | number | null; createdAt?: Date }>(
  rows: T[]
) {
  const seen = new Set<string>();

  return rows.filter((row) => {
    const key = [
      row.serviceType,
      row.applyOnRole,
      row.commissionType,
      toDecimalAmount(row.commissionValue).toFixed(2),
      getRangeKey(row.minAmount, row.maxAmount),
    ].join('|');

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function dedupeUserOverrides<T extends { id: string; serviceType: string; commissionType: string; commissionValue: Prisma.Decimal | string | number; minAmount: Prisma.Decimal | string | number; maxAmount: Prisma.Decimal | string | number | null }>(
  rows: T[]
) {
  const seen = new Set<string>();

  return rows.filter((row) => {
    const key = [
      row.serviceType,
      row.commissionType,
      toDecimalAmount(row.commissionValue).toFixed(2),
      getRangeKey(row.minAmount, row.maxAmount),
    ].join('|');

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function sendBadRequest(res: Response, message: string) {
  res.status(400).json({ success: false, message });
}

function parseRequiredDecimal(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === '') {
    throw new InputValidationError(`${fieldName} is required`);
  }

  let decimal: Prisma.Decimal;
  try {
    decimal = toDecimalAmount(value as Prisma.Decimal | string | number);
  } catch {
    throw new InputValidationError(`${fieldName} must be a valid amount`);
  }

  if (decimal.isNegative()) {
    throw new InputValidationError(`${fieldName} cannot be negative`);
  }

  return decimal;
}

function parseOptionalDecimal(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  let decimal: Prisma.Decimal;
  try {
    decimal = toDecimalAmount(value as Prisma.Decimal | string | number);
  } catch {
    throw new InputValidationError(`${fieldName} must be a valid amount`);
  }

  if (decimal.isNegative()) {
    throw new InputValidationError(`${fieldName} cannot be negative`);
  }

  return decimal;
}

function parseIsActive(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }

  return true;
}

async function findOverlappingDefaultSlab(
  setById: string,
  serviceType: string,
  applyOnRole: Role,
  minAmount: Prisma.Decimal,
  maxAmount: Prisma.Decimal | null,
  excludeId?: string
) {
  const rows = await prisma.commissionSlab.findMany({
    where: {
      setById,
      serviceType,
      applyOnRole,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      id: true,
      minAmount: true,
      maxAmount: true,
    },
  });

  return rows.find((row) => rangesOverlap(row.minAmount, row.maxAmount, minAmount, maxAmount));
}

async function findOverlappingOverride(
  setById: string,
  targetUserId: string,
  serviceType: string,
  minAmount: Prisma.Decimal,
  maxAmount: Prisma.Decimal | null,
  excludeId?: string
) {
  const rows = await prisma.userCommissionSetup.findMany({
    where: {
      setById,
      targetUserId,
      serviceType,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      id: true,
      minAmount: true,
      maxAmount: true,
    },
  });

  return rows.find((row) => rangesOverlap(row.minAmount, row.maxAmount, minAmount, maxAmount));
}

export const getSlabs = async (req: AuthRequest, res: Response) => {
  try {
    const slabs = dedupeCommissionSlabs(
      await prisma.commissionSlab.findMany({
      where: {
        setById: req.user!.id,
        serviceType: { in: ['PAYOUT', 'FUND_REQUEST'] },
      },
      orderBy: [{ serviceType: 'asc' }, { applyOnRole: 'asc' }, { minAmount: 'asc' }, { createdAt: 'asc' }],
      })
    );

    res.json({ success: true, slabs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const upsertSlab = async (req: AuthRequest, res: Response) => {
  const { id, serviceType, applyOnRole, commissionType, commissionValue, minAmount, maxAmount } = req.body;

  try {
    if (!isRateServiceType(serviceType)) {
      sendBadRequest(res, 'Unsupported service type');
      return;
    }

    const allowedRoles = getAssignableRateRoles(req.user!.role);
    if (!allowedRoles.includes(applyOnRole as Role)) {
      sendBadRequest(res, 'You cannot set default rates for this role');
      return;
    }

    if (!isCommissionType(commissionType)) {
      sendBadRequest(res, 'Unsupported commission type');
      return;
    }

    const normalizedMinAmount = parseRequiredDecimal(minAmount, 'minAmount');
    const normalizedMaxAmount = parseOptionalDecimal(maxAmount, 'maxAmount');
    const normalizedCommissionValue = parseRequiredDecimal(commissionValue, 'commissionValue');
    const isActive = parseIsActive(req.body.isActive);

    if (normalizedMaxAmount && normalizedMaxAmount.lessThan(normalizedMinAmount)) {
      sendBadRequest(res, 'maxAmount must be greater than or equal to minAmount');
      return;
    }

    const inheritedFloorError = await validateDefaultRateFloor(
      req.user!.id,
      applyOnRole as Role,
      serviceType,
      normalizedCommissionValue,
      normalizedMinAmount,
      normalizedMaxAmount,
      id
    );

    if (inheritedFloorError) {
      sendBadRequest(res, inheritedFloorError);
      return;
    }

    if (id) {
      const existingRow = await prisma.commissionSlab.findFirst({
        where: { id, setById: req.user!.id },
        select: { id: true },
      });

      if (!existingRow) {
        res.status(404).json({ success: false, message: 'Default rate not found' });
        return;
      }
    }

    const overlappingRow = await findOverlappingDefaultSlab(
      req.user!.id,
      serviceType,
      applyOnRole as Role,
      normalizedMinAmount,
      normalizedMaxAmount,
      id
    );

    if (overlappingRow) {
      sendBadRequest(res, 'This amount range overlaps with an existing default rate');
      return;
    }

    const slab = id
      ? await prisma.commissionSlab.update({
          where: { id },
          data: {
            serviceType,
            applyOnRole: applyOnRole as Role,
            commissionType,
            commissionValue: normalizedCommissionValue,
            minAmount: normalizedMinAmount,
            maxAmount: normalizedMaxAmount,
            isActive,
          },
        })
      : await prisma.commissionSlab.create({
          data: {
            setById: req.user!.id,
            serviceType,
            applyOnRole: applyOnRole as Role,
            commissionType,
            commissionValue: normalizedCommissionValue,
            minAmount: normalizedMinAmount,
            maxAmount: normalizedMaxAmount,
            isActive,
          },
        });

    res.json({ success: true, slab });
  } catch (error) {
    if (error instanceof InputValidationError) {
      sendBadRequest(res, error.message);
      return;
    }

    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteSlab = async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await prisma.commissionSlab.deleteMany({
      where: {
        id: req.params.id as string,
        setById: req.user!.id,
      },
    });

    if (deleted.count === 0) {
      res.status(404).json({ success: false, message: 'Default rate not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getUserOverrides = async (req: AuthRequest, res: Response) => {
  try {
    const overrides = dedupeUserOverrides(
      await prisma.userCommissionSetup.findMany({
      where: {
        setById: req.user!.id,
        serviceType: { in: ['PAYOUT', 'FUND_REQUEST'] },
      },
      include: {
        targetUser: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: {
              select: {
                ownerName: true,
                shopName: true,
              },
            },
          },
        },
      },
      orderBy: [{ targetUserId: 'asc' }, { serviceType: 'asc' }, { minAmount: 'asc' }, { createdAt: 'asc' }],
      })
    );

    res.json({ success: true, overrides });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const upsertUserOverride = async (req: AuthRequest, res: Response) => {
  const { id, targetUserId, serviceType, commissionType, commissionValue, minAmount, maxAmount } = req.body;

  try {
    if (!targetUserId) {
      sendBadRequest(res, 'targetUserId is required');
      return;
    }

    if (!isRateServiceType(serviceType)) {
      sendBadRequest(res, 'Unsupported service type');
      return;
    }

    if (!isCommissionType(commissionType)) {
      sendBadRequest(res, 'Unsupported commission type');
      return;
    }

    const hierarchyUsers = await fetchHierarchyUsers();
    const targetUser = hierarchyUsers.find((user) => user.id === targetUserId && user.isActive);

    if (!targetUser || !canManageTarget(req.user!, targetUserId, hierarchyUsers)) {
      sendBadRequest(res, 'You can only override rates for active users in your managed hierarchy');
      return;
    }

    const normalizedMinAmount = parseRequiredDecimal(minAmount, 'minAmount');
    const normalizedMaxAmount = parseOptionalDecimal(maxAmount, 'maxAmount');
    const normalizedCommissionValue = parseRequiredDecimal(commissionValue, 'commissionValue');
    const isActive = parseIsActive(req.body.isActive);

    if (normalizedMaxAmount && normalizedMaxAmount.lessThan(normalizedMinAmount)) {
      sendBadRequest(res, 'maxAmount must be greater than or equal to minAmount');
      return;
    }

    const inheritedFloorError = await validateUserOverrideFloor(
      targetUserId,
      serviceType,
      normalizedCommissionValue,
      normalizedMinAmount,
      normalizedMaxAmount,
      id
    );

    if (inheritedFloorError) {
      sendBadRequest(res, inheritedFloorError);
      return;
    }

    if (id) {
      const existingRow = await prisma.userCommissionSetup.findFirst({
        where: { id, setById: req.user!.id },
        select: { id: true },
      });

      if (!existingRow) {
        res.status(404).json({ success: false, message: 'User override not found' });
        return;
      }
    }

    const overlappingRow = await findOverlappingOverride(
      req.user!.id,
      targetUserId,
      serviceType,
      normalizedMinAmount,
      normalizedMaxAmount,
      id
    );

    if (overlappingRow) {
      sendBadRequest(res, 'This amount range overlaps with an existing user override');
      return;
    }

    const override = id
      ? await prisma.userCommissionSetup.update({
          where: { id },
          data: {
            targetUserId,
            serviceType,
            commissionType,
            commissionValue: normalizedCommissionValue,
            minAmount: normalizedMinAmount,
            maxAmount: normalizedMaxAmount,
            isActive,
          },
          include: {
            targetUser: {
              select: {
                id: true,
                email: true,
                role: true,
                profile: {
                  select: {
                    ownerName: true,
                    shopName: true,
                  },
                },
              },
            },
          },
        })
      : await prisma.userCommissionSetup.create({
          data: {
            setById: req.user!.id,
            targetUserId,
            serviceType,
            commissionType,
            commissionValue: normalizedCommissionValue,
            minAmount: normalizedMinAmount,
            maxAmount: normalizedMaxAmount,
            isActive,
          },
          include: {
            targetUser: {
              select: {
                id: true,
                email: true,
                role: true,
                profile: {
                  select: {
                    ownerName: true,
                    shopName: true,
                  },
                },
              },
            },
          },
        });

    res.json({ success: true, override });
  } catch (error) {
    if (error instanceof InputValidationError) {
      sendBadRequest(res, error.message);
      return;
    }

    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteUserOverride = async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await prisma.userCommissionSetup.deleteMany({
      where: {
        id: req.params.id as string,
        setById: req.user!.id,
      },
    });

    if (deleted.count === 0) {
      res.status(404).json({ success: false, message: 'User override not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getOverrideTargets = async (req: AuthRequest, res: Response) => {
  try {
    const hierarchyUsers = await fetchHierarchyUsers();
    const targetIds = getDescendantIds(req.user!.id, hierarchyUsers);

    const targets = await prisma.user.findMany({
      where: {
        id: { in: targetIds },
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        role: true,
        profile: {
          select: {
            ownerName: true,
            shopName: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    });

    res.json({ success: true, targets });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getEffectiveCommissionSlabs = async (req: AuthRequest, res: Response) => {
  try {
    const slabs = await buildEffectiveSlabs(req.user!.id);
    res.json({ success: true, slabs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
