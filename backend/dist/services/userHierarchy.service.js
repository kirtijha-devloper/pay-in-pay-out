"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchHierarchyUsers = fetchHierarchyUsers;
exports.buildHierarchyUserMap = buildHierarchyUserMap;
exports.getDescendantIds = getDescendantIds;
exports.canManageTarget = canManageTarget;
exports.getCreatedBySummary = getCreatedBySummary;
exports.getDerivedUpline = getDerivedUpline;
exports.decorateUsersWithHierarchy = decorateUsersWithHierarchy;
exports.decorateUserWithHierarchy = decorateUserWithHierarchy;
const prisma_1 = __importDefault(require("../lib/prisma"));
function toSummary(user) {
    if (!user)
        return null;
    return {
        id: user.id,
        email: user.email,
        role: user.role,
        ownerName: user.profile?.ownerName ?? null,
        shopName: user.profile?.shopName ?? null,
    };
}
async function fetchHierarchyUsers() {
    return prisma_1.default.user.findMany({
        select: {
            id: true,
            email: true,
            role: true,
            parentId: true,
            isActive: true,
            profile: {
                select: {
                    ownerName: true,
                    shopName: true,
                },
            },
        },
    });
}
function buildHierarchyUserMap(users) {
    return new Map(users.map((user) => [user.id, user]));
}
function buildChildrenMap(users) {
    const childrenMap = new Map();
    for (const user of users) {
        if (!user.parentId)
            continue;
        const children = childrenMap.get(user.parentId) ?? [];
        children.push(user);
        childrenMap.set(user.parentId, children);
    }
    return childrenMap;
}
function getDescendantIds(rootUserId, users) {
    const childrenMap = buildChildrenMap(users);
    const descendantIds = [];
    const queue = [rootUserId];
    while (queue.length > 0) {
        const currentId = queue.shift();
        if (!currentId)
            continue;
        const children = childrenMap.get(currentId) ?? [];
        for (const child of children) {
            descendantIds.push(child.id);
            queue.push(child.id);
        }
    }
    return descendantIds;
}
function canManageTarget(actor, targetUserId, users) {
    const userMap = buildHierarchyUserMap(users);
    if (!userMap.has(targetUserId)) {
        return false;
    }
    if (actor.role === 'ADMIN') {
        return true;
    }
    return getDescendantIds(actor.id, users).includes(targetUserId);
}
function getCreatedBySummary(user, userMap) {
    if (!user.parentId) {
        return null;
    }
    return toSummary(userMap.get(user.parentId));
}
function getDerivedUpline(user, userMap) {
    const upline = {
        admin: null,
        super: null,
        distributor: null,
    };
    let currentParentId = user.parentId;
    const visited = new Set();
    while (currentParentId && !visited.has(currentParentId)) {
        visited.add(currentParentId);
        const ancestor = userMap.get(currentParentId);
        if (!ancestor) {
            break;
        }
        if (ancestor.role === 'ADMIN' && !upline.admin) {
            upline.admin = toSummary(ancestor);
        }
        if (ancestor.role === 'SUPER' && !upline.super) {
            upline.super = toSummary(ancestor);
        }
        if (ancestor.role === 'DISTRIBUTOR' && !upline.distributor) {
            upline.distributor = toSummary(ancestor);
        }
        currentParentId = ancestor.parentId;
    }
    return upline;
}
function decorateUsersWithHierarchy(users, hierarchyUsers) {
    const userMap = buildHierarchyUserMap(hierarchyUsers);
    return users.map((user) => ({
        ...user,
        createdBy: getCreatedBySummary(user, userMap),
        upline: getDerivedUpline(user, userMap),
    }));
}
function decorateUserWithHierarchy(user, hierarchyUsers) {
    const [decoratedUser] = decorateUsersWithHierarchy([user], hierarchyUsers);
    return decoratedUser;
}
