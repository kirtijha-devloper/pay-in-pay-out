import { Prisma, Role } from '@prisma/client';
import prisma from '../lib/prisma';

export const MANAGER_ROLE_SCOPE: Record<Role, Role[]> = {
  ADMIN: ['SUPER', 'DISTRIBUTOR', 'RETAILER'],
  SUPER: ['DISTRIBUTOR', 'RETAILER'],
  DISTRIBUTOR: ['RETAILER'],
  RETAILER: [],
};

export const MANAGER_ROLES: Role[] = ['ADMIN', 'SUPER', 'DISTRIBUTOR'];
export const RATE_SERVICE_TYPES = ['PAYOUT', 'FUND_REQUEST'] as const;

type ChainUser = {
  id: string;
  role: Role;
  parentId: string | null;
};

type HierarchyChain = {
  user: ChainUser;
  ancestors: ChainUser[];
};

type RateContextOptions = {
  excludeDefaultId?: string;
  excludeOverrideId?: string;
};

type RateRowBase = {
  id: string;
  serviceType: string;
  commissionType: string;
  commissionValue: Prisma.Decimal | string | number;
  minAmount: Prisma.Decimal | string | number;
  maxAmount: Prisma.Decimal | string | number | null;
};

type NormalizedRateRow = {
  id: string;
  setById: string;
  serviceType: string;
  commissionType: string;
  commissionValue: string;
  minPaise: number;
  maxPaise: number | null;
};

type NormalizedDefaultRow = NormalizedRateRow & {
  applyOnRole: Role;
};

type NormalizedOverrideRow = NormalizedRateRow & {
  targetUserId: string;
};

type ResolvedRateRow = NormalizedDefaultRow | NormalizedOverrideRow;

export type EffectiveChargeSlab = {
  serviceType: string;
  commissionType: string;
  commissionValue: string;
  minAmount: string;
  maxAmount: string | null;
};

export type ChargeDistributionEntry = {
  receiverId: string;
  amount: number;
};

export function toDecimalAmount(value: Prisma.Decimal | string | number) {
  return new Prisma.Decimal(value).toDecimalPlaces(2);
}

function toPaise(value: Prisma.Decimal | string | number) {
  return toDecimalAmount(value).mul(100).toDecimalPlaces(0).toNumber();
}

function paiseToAmount(value: number) {
  return new Prisma.Decimal(value).div(100).toFixed(2);
}

function matchesAmount(row: { minPaise: number; maxPaise: number | null }, amountPaise: number) {
  return amountPaise >= row.minPaise && (row.maxPaise === null || amountPaise <= row.maxPaise);
}

function normalizeBaseRateRow<Row extends RateRowBase>(row: Row, setById: string): NormalizedRateRow {
  return {
    id: row.id,
    setById,
    serviceType: row.serviceType,
    commissionType: row.commissionType,
    commissionValue: toDecimalAmount(row.commissionValue).toFixed(2),
    minPaise: toPaise(row.minAmount),
    maxPaise: row.maxAmount === null ? null : toPaise(row.maxAmount),
  };
}

function normalizeDefaultRow(row: {
  id: string;
  setById: string;
  serviceType: string;
  applyOnRole: Role;
  commissionType: string;
  commissionValue: Prisma.Decimal | string | number;
  minAmount: Prisma.Decimal | string | number;
  maxAmount: Prisma.Decimal | string | number | null;
}) {
  return {
    ...normalizeBaseRateRow(row, row.setById),
    applyOnRole: row.applyOnRole,
  };
}

function normalizeOverrideRow(row: {
  id: string;
  setById: string;
  targetUserId: string;
  serviceType: string;
  commissionType: string;
  commissionValue: Prisma.Decimal | string | number;
  minAmount: Prisma.Decimal | string | number;
  maxAmount: Prisma.Decimal | string | number | null;
}) {
  return {
    ...normalizeBaseRateRow(row, row.setById),
    targetUserId: row.targetUserId,
  };
}

function computeCharge(
  row: Pick<NormalizedRateRow, 'commissionType' | 'commissionValue'>,
  amount: Prisma.Decimal
) {
  if (row.commissionType === 'PERCENTAGE') {
    return amount.mul(row.commissionValue).div(100).toDecimalPlaces(2).toNumber();
  }

  return toDecimalAmount(row.commissionValue).toNumber();
}

export function getAssignableRateRoles(actorRole: string) {
  return MANAGER_ROLE_SCOPE[actorRole as Role] ?? [];
}

export function isManagerRole(role: string) {
  return MANAGER_ROLES.includes(role as Role);
}

export function isRateServiceType(serviceType: string) {
  return RATE_SERVICE_TYPES.includes(serviceType as (typeof RATE_SERVICE_TYPES)[number]);
}

export function isCommissionType(value: string) {
  return value === 'FLAT' || value === 'PERCENTAGE';
}

export function rangesOverlap(
  firstMin: Prisma.Decimal | string | number,
  firstMax: Prisma.Decimal | string | number | null,
  secondMin: Prisma.Decimal | string | number,
  secondMax: Prisma.Decimal | string | number | null
) {
  const firstMinPaise = toPaise(firstMin);
  const secondMinPaise = toPaise(secondMin);
  const firstMaxPaise = firstMax === null ? Number.POSITIVE_INFINITY : toPaise(firstMax);
  const secondMaxPaise = secondMax === null ? Number.POSITIVE_INFINITY : toPaise(secondMax);

  return firstMinPaise <= secondMaxPaise && secondMinPaise <= firstMaxPaise;
}

async function loadHierarchyChain(userId: string): Promise<HierarchyChain | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, parentId: true },
  });

  if (!user) {
    return null;
  }

  const ancestors: ChainUser[] = [];
  const visited = new Set<string>([user.id]);
  let currentParentId = user.parentId;

  while (currentParentId && !visited.has(currentParentId)) {
    const ancestor = await prisma.user.findUnique({
      where: { id: currentParentId },
      select: { id: true, role: true, parentId: true },
    });

    if (!ancestor) {
      break;
    }

    ancestors.push(ancestor);
    visited.add(ancestor.id);
    currentParentId = ancestor.parentId;
  }

  return { user, ancestors };
}

async function loadRateContext(userId: string, serviceTypes: readonly string[], options: RateContextOptions = {}) {
  const chain = await loadHierarchyChain(userId);
  if (!chain) {
    return null;
  }

  const ancestorIds = chain.ancestors.map((ancestor) => ancestor.id);
  if (ancestorIds.length === 0) {
    return {
      ...chain,
      defaults: [] as NormalizedDefaultRow[],
      overrides: [] as NormalizedOverrideRow[],
    };
  }

  const [defaults, overrides] = await Promise.all([
    prisma.commissionSlab.findMany({
      where: {
        setById: { in: ancestorIds },
        serviceType: { in: [...serviceTypes] },
        isActive: true,
        ...(options.excludeDefaultId ? { id: { not: options.excludeDefaultId } } : {}),
      },
      orderBy: [{ setById: 'asc' }, { serviceType: 'asc' }, { minAmount: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.userCommissionSetup.findMany({
      where: {
        setById: { in: ancestorIds },
        targetUserId: chain.user.id,
        serviceType: { in: [...serviceTypes] },
        isActive: true,
        ...(options.excludeOverrideId ? { id: { not: options.excludeOverrideId } } : {}),
      },
      orderBy: [{ setById: 'asc' }, { serviceType: 'asc' }, { minAmount: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);

  return {
    ...chain,
    defaults: defaults.map(normalizeDefaultRow),
    overrides: overrides.map(normalizeOverrideRow),
  };
}

function selectResolvedRate(
  user: ChainUser,
  ancestors: ChainUser[],
  serviceType: string,
  amountPaise: number,
  defaults: NormalizedDefaultRow[],
  overrides: NormalizedOverrideRow[]
) {
  for (const ancestor of ancestors) {
    const override = overrides.find(
      (row) => row.setById === ancestor.id && row.serviceType === serviceType && matchesAmount(row, amountPaise)
    );

    if (override) {
      return override;
    }

    const roleDefaultRow = defaults.find(
      (row) =>
        row.setById === ancestor.id &&
        row.serviceType === serviceType &&
        row.applyOnRole === user.role &&
        matchesAmount(row, amountPaise)
    );

    if (roleDefaultRow) {
      return roleDefaultRow;
    }

    // If the ancestor has a default slab for this amount but not for the
    // current user's role, treat it as the inherited fallback for that branch.
    const fallbackDefaultRow = defaults.find(
      (row) => row.setById === ancestor.id && row.serviceType === serviceType && matchesAmount(row, amountPaise)
    );

    if (fallbackDefaultRow) {
      return fallbackDefaultRow;
    }
  }

  return null;
}

function collectServiceBoundaries(
  defaults: NormalizedDefaultRow[],
  overrides: NormalizedOverrideRow[],
  serviceType: string
) {
  const boundaries = new Set<number>();

  for (const row of [...defaults, ...overrides]) {
    if (row.serviceType !== serviceType) {
      continue;
    }

    boundaries.add(row.minPaise);
    if (row.maxPaise !== null) {
      boundaries.add(row.maxPaise + 1);
    }
  }

  return Array.from(boundaries).sort((left, right) => left - right);
}

function mergeSegments(
  segments: Array<{
    commissionType: string;
    commissionValue: string;
    minPaise: number;
    maxPaise: number | null;
  }>
) {
  return segments.reduce<typeof segments>((result, current) => {
    const previous = result[result.length - 1];

    if (
      previous &&
      previous.commissionType === current.commissionType &&
      previous.commissionValue === current.commissionValue &&
      previous.maxPaise !== null &&
      previous.maxPaise + 1 === current.minPaise
    ) {
      previous.maxPaise = current.maxPaise;
      return result;
    }

    result.push({ ...current });
    return result;
  }, []);
}

function buildEffectiveSlabsForService(
  user: ChainUser,
  ancestors: ChainUser[],
  defaults: NormalizedDefaultRow[],
  overrides: NormalizedOverrideRow[],
  serviceType: string
) {
  const boundaries = collectServiceBoundaries(defaults, overrides, serviceType);
  if (boundaries.length === 0) {
    return [] as EffectiveChargeSlab[];
  }

  const segments: Array<{
    commissionType: string;
    commissionValue: string;
    minPaise: number;
    maxPaise: number | null;
  }> = [];

  for (let index = 0; index < boundaries.length; index += 1) {
    const minPaise = boundaries[index];
    const nextBoundary = boundaries[index + 1] ?? null;
    const resolvedRow = selectResolvedRate(user, ancestors, serviceType, minPaise, defaults, overrides);

    if (!resolvedRow) {
      continue;
    }

    const maxPaise =
      nextBoundary === null ? resolvedRow.maxPaise : Math.min(nextBoundary - 1, resolvedRow.maxPaise ?? nextBoundary - 1);

    if (maxPaise !== null && maxPaise < minPaise) {
      continue;
    }

    segments.push({
      commissionType: resolvedRow.commissionType,
      commissionValue: resolvedRow.commissionValue,
      minPaise,
      maxPaise,
    });
  }

  return mergeSegments(segments).map((segment) => ({
    serviceType,
    commissionType: segment.commissionType,
    commissionValue: segment.commissionValue,
    minAmount: paiseToAmount(segment.minPaise),
    maxAmount: segment.maxPaise === null ? null : paiseToAmount(segment.maxPaise),
  }));
}

function collectCheckPoints(
  rows: Array<{ minPaise: number }>,
  minPaise: number,
  maxPaise: number | null
) {
  const points = new Set<number>([minPaise]);

  for (const row of rows) {
    if (row.minPaise >= minPaise && (maxPaise === null || row.minPaise <= maxPaise)) {
      points.add(row.minPaise);
    }
  }

  if (maxPaise !== null) {
    points.add(maxPaise);
  }

  return Array.from(points).sort((left, right) => left - right);
}

async function validateDefaultRateFloorInternal(
  actorId: string,
  applyOnRole: Role,
  serviceType: string,
  commissionValueInput: Prisma.Decimal | string | number,
  minAmount: Prisma.Decimal | string | number,
  maxAmount: Prisma.Decimal | string | number | null,
  excludeDefaultId?: string
) {
  const context = await loadRateContext(actorId, [serviceType], { excludeDefaultId });
  if (!context) {
    return null;
  }

  const defaultRows = context.defaults.filter((row) => row.serviceType === serviceType);
  const minPaise = toPaise(minAmount);
  const maxPaise = maxAmount === null ? null : toPaise(maxAmount);
  const points = collectCheckPoints(defaultRows, minPaise, maxPaise);
  const candidateValue = toDecimalAmount(commissionValueInput);
  const pseudoUser: ChainUser = { id: actorId, role: applyOnRole, parentId: null };

  for (const point of points) {
    const floorRow = selectResolvedRate(pseudoUser, context.ancestors, serviceType, point, defaultRows, []);
    if (!floorRow) {
      continue;
    }

    if (candidateValue.lessThan(toDecimalAmount(floorRow.commissionValue))) {
      return 'Default rate cannot be lower than the inherited rate for this range';
    }
  }

  return null;
}

async function validateOverrideRateFloorInternal(
  targetUserId: string,
  serviceType: string,
  commissionValueInput: Prisma.Decimal | string | number,
  minAmount: Prisma.Decimal | string | number,
  maxAmount: Prisma.Decimal | string | number | null,
  excludeOverrideId?: string
) {
  const context = await loadRateContext(targetUserId, [serviceType], { excludeOverrideId });
  if (!context) {
    return null;
  }

  const relevantRows = [...context.defaults, ...context.overrides].filter((row) => row.serviceType === serviceType);
  const minPaise = toPaise(minAmount);
  const maxPaise = maxAmount === null ? null : toPaise(maxAmount);
  const points = collectCheckPoints(relevantRows, minPaise, maxPaise);
  const candidateValue = toDecimalAmount(commissionValueInput);

  for (const point of points) {
    const floorRow = selectResolvedRate(
      context.user,
      context.ancestors,
      serviceType,
      point,
      context.defaults,
      context.overrides
    );

    if (!floorRow) {
      continue;
    }

    if (candidateValue.lessThan(toDecimalAmount(floorRow.commissionValue))) {
      return 'User override cannot be lower than the inherited rate for this range';
    }
  }

  return null;
}

export async function validateDefaultRateFloor(
  actorId: string,
  applyOnRole: Role,
  serviceType: string,
  commissionValueInput: Prisma.Decimal | string | number,
  minAmount: Prisma.Decimal | string | number,
  maxAmount: Prisma.Decimal | string | number | null,
  excludeDefaultId?: string
) {
  return validateDefaultRateFloorInternal(
    actorId,
    applyOnRole,
    serviceType,
    commissionValueInput,
    minAmount,
    maxAmount,
    excludeDefaultId
  );
}

export async function validateUserOverrideFloor(
  targetUserId: string,
  serviceType: string,
  commissionValueInput: Prisma.Decimal | string | number,
  minAmount: Prisma.Decimal | string | number,
  maxAmount: Prisma.Decimal | string | number | null,
  excludeOverrideId?: string
) {
  return validateOverrideRateFloorInternal(
    targetUserId,
    serviceType,
    commissionValueInput,
    minAmount,
    maxAmount,
    excludeOverrideId
  );
}

export async function buildChargeDistribution(
  userId: string,
  serviceType: string,
  amountInput: Prisma.Decimal | string | number
) {
  const context = await loadHierarchyChain(userId);
  if (!context) {
    return [] as ChargeDistributionEntry[];
  }

  const amount = toDecimalAmount(amountInput);
  const beneficiaries = [...context.ancestors].reverse();
  if (beneficiaries.length === 0) {
    return [] as ChargeDistributionEntry[];
  }

  const charges = await Promise.all(beneficiaries.map((node) => resolveCharge(node.id, serviceType, amount.toNumber())));
  const shares: ChargeDistributionEntry[] = [];

  for (let index = 0; index < beneficiaries.length; index += 1) {
    const currentCharge = charges[index] ?? 0;
    const previousCharge = index === 0 ? 0 : charges[index - 1] ?? 0;
    const share = Math.max(currentCharge - previousCharge, 0);

    if (share > 0) {
      shares.push({
        receiverId: beneficiaries[index].id,
        amount: new Prisma.Decimal(share).toDecimalPlaces(2).toNumber(),
      });
    }
  }

  return shares;
}

export async function resolveCharge(userId: string, serviceType: string, amountInput: number) {
  const context = await loadRateContext(userId, [serviceType]);
  if (!context) {
    return 0;
  }

  const amount = toDecimalAmount(amountInput);
  const amountPaise = amount.mul(100).toDecimalPlaces(0).toNumber();
  const row = selectResolvedRate(
    context.user,
    context.ancestors,
    serviceType,
    amountPaise,
    context.defaults,
    context.overrides
  );

  if (!row) {
    return 0;
  }

  return computeCharge(row, amount);
}

export async function buildEffectiveSlabs(userId: string) {
  const context = await loadRateContext(userId, RATE_SERVICE_TYPES);
  if (!context) {
    return [] as EffectiveChargeSlab[];
  }

  return RATE_SERVICE_TYPES.flatMap((serviceType) =>
    buildEffectiveSlabsForService(context.user, context.ancestors, context.defaults, context.overrides, serviceType)
  );
}
