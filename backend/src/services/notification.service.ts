import prisma from '../lib/prisma';
import { fetchHierarchyUsers, getAncestorIds } from './userHierarchy.service';

export type NotificationType = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export const createNotification = async (
  userId: string,
  title: string,
  message: string,
  type: NotificationType = 'INFO'
) => {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
      },
    });
  } catch (err) {
    console.error('Failed to create notification:', err);
    return null;
  }
};

export const createAdminNotification = async (
  title: string,
  message: string,
  type: NotificationType = 'INFO'
) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    const notifications = admins.map((admin) => ({
      userId: admin.id,
      title,
      message,
      type,
    }));

    return await prisma.notification.createMany({
      data: notifications,
    });
  } catch (err) {
    console.error('Failed to create admin notifications:', err);
    return null;
  }
};

export const createNotificationsForUsers = async (
  userIds: string[],
  title: string,
  message: string,
  type: NotificationType = 'INFO'
) => {
  try {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

    if (uniqueUserIds.length === 0) {
      return null;
    }

    return await prisma.notification.createMany({
      data: uniqueUserIds.map((userId) => ({
        userId,
        title,
        message,
        type,
      })),
    });
  } catch (err) {
    console.error('Failed to create notifications:', err);
    return null;
  }
};

export const notifyAdminsAndUser = async (
  userId: string,
  title: string,
  message: string,
  type: NotificationType = 'INFO'
) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    return await createNotificationsForUsers(
      [userId, ...admins.map((admin) => admin.id)],
      title,
      message,
      type
    );
  } catch (err) {
    console.error('Failed to notify admins and user:', err);
    return null;
  }
};

export const createHierarchyNotification = async (
  actorId: string,
  title: string,
  message: string,
  type: NotificationType = 'INFO'
) => {
  try {
    const users = await fetchHierarchyUsers();
    const ancestorIds = getAncestorIds(actorId, users);

    if (ancestorIds.length === 0) return null;

    const notifications = ancestorIds.map((id) => ({
      userId: id,
      title,
      message,
      type,
    }));

    return await prisma.notification.createMany({
      data: notifications,
    });
  } catch (err) {
    console.error('Failed to create hierarchy notifications:', err);
    return null;
  }
};
