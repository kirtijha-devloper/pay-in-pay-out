import { Role } from '@prisma/client';
import prisma from '../lib/prisma';

type HierarchyProfile = {
  ownerName: string;
  shopName: string;
} | null;

export type HierarchySummary = {
  id: string;
  email: string;
  role: Role;
  ownerName: string | null;
  shopName: string | null;
};

export type DerivedUpline = {
  admin: HierarchySummary | null;
  super: HierarchySummary | null;
  distributor: HierarchySummary | null;
};

export type HierarchyUser = {
  id: string;
  email: string;
  role: Role;
  parentId: string | null;
  isActive: boolean;
  profile: HierarchyProfile;
};

function toSummary(user: HierarchyUser | null | undefined): HierarchySummary | null {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    ownerName: user.profile?.ownerName ?? null,
    shopName: user.profile?.shopName ?? null,
  };
}

export async function fetchHierarchyUsers(): Promise<HierarchyUser[]> {
  return prisma.user.findMany({
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

export function buildHierarchyUserMap(users: HierarchyUser[]) {
  return new Map(users.map((user) => [user.id, user]));
}

function buildChildrenMap(users: HierarchyUser[]) {
  const childrenMap = new Map<string, HierarchyUser[]>();

  for (const user of users) {
    if (!user.parentId) continue;

    const children = childrenMap.get(user.parentId) ?? [];
    children.push(user);
    childrenMap.set(user.parentId, children);
  }

  return childrenMap;
}

export function getDescendantIds(rootUserId: string, users: HierarchyUser[]) {
  const childrenMap = buildChildrenMap(users);
  const descendantIds: string[] = [];
  const queue = [rootUserId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) continue;

    const children = childrenMap.get(currentId) ?? [];
    for (const child of children) {
      descendantIds.push(child.id);
      queue.push(child.id);
    }
  }

  return descendantIds;
}

export function canManageTarget(
  actor: { id: string; role: string },
  targetUserId: string,
  users: HierarchyUser[]
) {
  const userMap = buildHierarchyUserMap(users);

  if (!userMap.has(targetUserId)) {
    return false;
  }

  if (actor.role === 'ADMIN') {
    return true;
  }

  return getDescendantIds(actor.id, users).includes(targetUserId);
}

export function getCreatedBySummary(
  user: { parentId: string | null },
  userMap: Map<string, HierarchyUser>
) {
  if (!user.parentId) {
    return null;
  }

  return toSummary(userMap.get(user.parentId));
}

export function getDerivedUpline(
  user: { parentId: string | null },
  userMap: Map<string, HierarchyUser>
): DerivedUpline {
  const upline: DerivedUpline = {
    admin: null,
    super: null,
    distributor: null,
  };

  let currentParentId = user.parentId;
  const visited = new Set<string>();

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

export function decorateUsersWithHierarchy<T extends { id: string; parentId: string | null }>(
  users: T[],
  hierarchyUsers: HierarchyUser[]
) {
  const userMap = buildHierarchyUserMap(hierarchyUsers);

  return users.map((user) => ({
    ...user,
    createdBy: getCreatedBySummary(user, userMap),
    upline: getDerivedUpline(user, userMap),
  }));
}

export function decorateUserWithHierarchy<T extends { id: string; parentId: string | null }>(
  user: T,
  hierarchyUsers: HierarchyUser[]
) {
  const [decoratedUser] = decorateUsersWithHierarchy([user], hierarchyUsers);
  return decoratedUser;
}
