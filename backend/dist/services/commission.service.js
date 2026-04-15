"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RATE_SERVICE_TYPES = exports.MANAGER_ROLES = exports.MANAGER_ROLE_SCOPE = void 0;
exports.toDecimalAmount = toDecimalAmount;
exports.getAssignableRateRoles = getAssignableRateRoles;
exports.isManagerRole = isManagerRole;
exports.isRateServiceType = isRateServiceType;
exports.isCommissionType = isCommissionType;
exports.rangesOverlap = rangesOverlap;
exports.validateDefaultRateFloor = validateDefaultRateFloor;
exports.validateUserOverrideFloor = validateUserOverrideFloor;
exports.buildChargeDistribution = buildChargeDistribution;
exports.resolveCharge = resolveCharge;
exports.buildEffectiveSlabs = buildEffectiveSlabs;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../lib/prisma"));
exports.MANAGER_ROLE_SCOPE = {
    ADMIN: ['SUPER', 'DISTRIBUTOR', 'RETAILER'],
    SUPER: ['DISTRIBUTOR', 'RETAILER'],
    DISTRIBUTOR: ['RETAILER'],
    RETAILER: [],
};
exports.MANAGER_ROLES = ['ADMIN', 'SUPER', 'DISTRIBUTOR'];
exports.RATE_SERVICE_TYPES = ['PAYOUT', 'FUND_REQUEST'];
function toDecimalAmount(value) {
    return new client_1.Prisma.Decimal(value).toDecimalPlaces(2);
}
function toPaise(value) {
    return toDecimalAmount(value).mul(100).toDecimalPlaces(0).toNumber();
}
function paiseToAmount(value) {
    return new client_1.Prisma.Decimal(value).div(100).toFixed(2);
}
function matchesAmount(row, amountPaise) {
    return amountPaise >= row.minPaise && (row.maxPaise === null || amountPaise <= row.maxPaise);
}
function normalizeBaseRateRow(row, setById) {
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
function normalizeDefaultRow(row) {
    return {
        ...normalizeBaseRateRow(row, row.setById),
        applyOnRole: row.applyOnRole,
    };
}
function normalizeOverrideRow(row) {
    return {
        ...normalizeBaseRateRow(row, row.setById),
        targetUserId: row.targetUserId,
    };
}
function computeCharge(row, amount) {
    if (row.commissionType === 'PERCENTAGE') {
        return amount.mul(row.commissionValue).div(100).toDecimalPlaces(2).toNumber();
    }
    return toDecimalAmount(row.commissionValue).toNumber();
}
function resolveChargeWithinAncestorScope(user, scopedAncestors, serviceType, amountInput, defaults, overrides) {
    const amount = toDecimalAmount(amountInput);
    const amountPaise = amount.mul(100).toDecimalPlaces(0).toNumber();
    const scopeIds = new Set(scopedAncestors.map((ancestor) => ancestor.id));
    const scopedDefaults = defaults.filter((row) => row.serviceType === serviceType && scopeIds.has(row.setById));
    const scopedOverrides = overrides.filter((row) => row.serviceType === serviceType && scopeIds.has(row.setById));
    const row = selectResolvedRate(user, scopedAncestors, serviceType, amountPaise, scopedDefaults, scopedOverrides);
    if (!row) {
        return 0;
    }
    return computeCharge(row, amount);
}
function getAssignableRateRoles(actorRole) {
    return exports.MANAGER_ROLE_SCOPE[actorRole] ?? [];
}
function isManagerRole(role) {
    return exports.MANAGER_ROLES.includes(role);
}
function isRateServiceType(serviceType) {
    return exports.RATE_SERVICE_TYPES.includes(serviceType);
}
function isCommissionType(value) {
    return value === 'FLAT' || value === 'PERCENTAGE';
}
function rangesOverlap(firstMin, firstMax, secondMin, secondMax) {
    const firstMinPaise = toPaise(firstMin);
    const secondMinPaise = toPaise(secondMin);
    const firstMaxPaise = firstMax === null ? Number.POSITIVE_INFINITY : toPaise(firstMax);
    const secondMaxPaise = secondMax === null ? Number.POSITIVE_INFINITY : toPaise(secondMax);
    return firstMinPaise <= secondMaxPaise && secondMinPaise <= firstMaxPaise;
}
async function loadHierarchyChain(userId) {
    const user = await prisma_1.default.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, parentId: true },
    });
    if (!user) {
        return null;
    }
    const ancestors = [];
    const visited = new Set([user.id]);
    let currentParentId = user.parentId;
    while (currentParentId && !visited.has(currentParentId)) {
        const ancestor = await prisma_1.default.user.findUnique({
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
async function loadRateContext(userId, serviceTypes, options = {}) {
    const chain = await loadHierarchyChain(userId);
    if (!chain) {
        return null;
    }
    const ancestorIds = chain.ancestors.map((ancestor) => ancestor.id);
    if (ancestorIds.length === 0) {
        return {
            ...chain,
            defaults: [],
            overrides: [],
        };
    }
    const [defaults, overrides] = await Promise.all([
        prisma_1.default.commissionSlab.findMany({
            where: {
                setById: { in: ancestorIds },
                serviceType: { in: [...serviceTypes] },
                isActive: true,
                ...(options.excludeDefaultId ? { id: { not: options.excludeDefaultId } } : {}),
            },
            orderBy: [{ setById: 'asc' }, { serviceType: 'asc' }, { minAmount: 'asc' }, { createdAt: 'asc' }],
        }),
        prisma_1.default.userCommissionSetup.findMany({
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
function selectResolvedRate(user, ancestors, serviceType, amountPaise, defaults, overrides) {
    for (const ancestor of ancestors) {
        const override = overrides.find((row) => row.setById === ancestor.id && row.serviceType === serviceType && matchesAmount(row, amountPaise));
        if (override) {
            return override;
        }
        const roleDefaultRow = defaults.find((row) => row.setById === ancestor.id &&
            row.serviceType === serviceType &&
            row.applyOnRole === user.role &&
            matchesAmount(row, amountPaise));
        if (roleDefaultRow) {
            return roleDefaultRow;
        }
        // If the ancestor has a default slab for this amount but not for the
        // current user's role, treat it as the inherited fallback for that branch.
        const fallbackDefaultRow = defaults.find((row) => row.setById === ancestor.id && row.serviceType === serviceType && matchesAmount(row, amountPaise));
        if (fallbackDefaultRow) {
            return fallbackDefaultRow;
        }
    }
    return null;
}
function collectServiceBoundaries(defaults, overrides, serviceType) {
    const boundaries = new Set();
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
function mergeSegments(segments) {
    return segments.reduce((result, current) => {
        const previous = result[result.length - 1];
        if (previous &&
            previous.commissionType === current.commissionType &&
            previous.commissionValue === current.commissionValue &&
            previous.maxPaise !== null &&
            previous.maxPaise + 1 === current.minPaise) {
            previous.maxPaise = current.maxPaise;
            return result;
        }
        result.push({ ...current });
        return result;
    }, []);
}
function buildEffectiveSlabsForService(user, ancestors, defaults, overrides, serviceType) {
    const boundaries = collectServiceBoundaries(defaults, overrides, serviceType);
    if (boundaries.length === 0) {
        return [];
    }
    const segments = [];
    for (let index = 0; index < boundaries.length; index += 1) {
        const minPaise = boundaries[index];
        const nextBoundary = boundaries[index + 1] ?? null;
        const resolvedRow = selectResolvedRate(user, ancestors, serviceType, minPaise, defaults, overrides);
        if (!resolvedRow) {
            continue;
        }
        const maxPaise = nextBoundary === null ? resolvedRow.maxPaise : Math.min(nextBoundary - 1, resolvedRow.maxPaise ?? nextBoundary - 1);
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
function collectCheckPoints(rows, minPaise, maxPaise) {
    const points = new Set([minPaise]);
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
async function validateDefaultRateFloorInternal(actorId, applyOnRole, serviceType, commissionValueInput, minAmount, maxAmount, excludeDefaultId) {
    const context = await loadRateContext(actorId, [serviceType], { excludeDefaultId });
    if (!context) {
        return null;
    }
    const defaultRows = context.defaults.filter((row) => row.serviceType === serviceType);
    const minPaise = toPaise(minAmount);
    const maxPaise = maxAmount === null ? null : toPaise(maxAmount);
    const points = collectCheckPoints(defaultRows, minPaise, maxPaise);
    const candidateValue = toDecimalAmount(commissionValueInput);
    const pseudoUser = { id: actorId, role: applyOnRole, parentId: null };
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
async function validateOverrideRateFloorInternal(targetUserId, serviceType, commissionValueInput, minAmount, maxAmount, excludeOverrideId) {
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
        const floorRow = selectResolvedRate(context.user, context.ancestors, serviceType, point, context.defaults, context.overrides);
        if (!floorRow) {
            continue;
        }
        if (candidateValue.lessThan(toDecimalAmount(floorRow.commissionValue))) {
            return 'User override cannot be lower than the inherited rate for this range';
        }
    }
    return null;
}
async function validateDefaultRateFloor(actorId, applyOnRole, serviceType, commissionValueInput, minAmount, maxAmount, excludeDefaultId) {
    return validateDefaultRateFloorInternal(actorId, applyOnRole, serviceType, commissionValueInput, minAmount, maxAmount, excludeDefaultId);
}
async function validateUserOverrideFloor(targetUserId, serviceType, commissionValueInput, minAmount, maxAmount, excludeOverrideId) {
    return validateOverrideRateFloorInternal(targetUserId, serviceType, commissionValueInput, minAmount, maxAmount, excludeOverrideId);
}
async function buildChargeDistribution(userId, serviceType, amountInput) {
    const context = await loadRateContext(userId, [serviceType]);
    if (!context) {
        return [];
    }
    const amount = toDecimalAmount(amountInput);
    const beneficiaries = [...context.ancestors].reverse();
    if (beneficiaries.length === 0) {
        return [];
    }
    const charges = await Promise.all(beneficiaries.map((_, index) => {
        const scopedAncestors = context.ancestors.slice(context.ancestors.length - 1 - index);
        return Promise.resolve(resolveChargeWithinAncestorScope(context.user, scopedAncestors, serviceType, amount, context.defaults, context.overrides));
    }));
    const shares = [];
    for (let index = 0; index < beneficiaries.length; index += 1) {
        const currentCharge = charges[index] ?? 0;
        const previousCharge = index === 0 ? 0 : charges[index - 1] ?? 0;
        const share = Math.max(currentCharge - previousCharge, 0);
        if (share > 0) {
            shares.push({
                receiverId: beneficiaries[index].id,
                amount: new client_1.Prisma.Decimal(share).toDecimalPlaces(2).toNumber(),
            });
        }
    }
    return shares;
}
async function resolveCharge(userId, serviceType, amountInput) {
    const context = await loadRateContext(userId, [serviceType]);
    if (!context) {
        return 0;
    }
    const amount = toDecimalAmount(amountInput);
    const amountPaise = amount.mul(100).toDecimalPlaces(0).toNumber();
    const row = selectResolvedRate(context.user, context.ancestors, serviceType, amountPaise, context.defaults, context.overrides);
    if (!row) {
        return 0;
    }
    return computeCharge(row, amount);
}
async function buildEffectiveSlabs(userId) {
    const context = await loadRateContext(userId, exports.RATE_SERVICE_TYPES);
    if (!context) {
        return [];
    }
    return exports.RATE_SERVICE_TYPES.flatMap((serviceType) => buildEffectiveSlabsForService(context.user, context.ancestors, context.defaults, context.overrides, serviceType));
}
