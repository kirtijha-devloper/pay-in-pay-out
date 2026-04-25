"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHierarchyNotification = exports.notifyAdminsAndUser = exports.createNotificationsForUsers = exports.createAdminNotification = exports.createNotification = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const userHierarchy_service_1 = require("./userHierarchy.service");
const createNotification = async (userId, title, message, type = 'INFO') => {
    try {
        return await prisma_1.default.notification.create({
            data: {
                userId,
                title,
                message,
                type,
            },
        });
    }
    catch (err) {
        console.error('Failed to create notification:', err);
        return null;
    }
};
exports.createNotification = createNotification;
const createAdminNotification = async (title, message, type = 'INFO') => {
    try {
        const admins = await prisma_1.default.user.findMany({
            where: { role: 'ADMIN' },
            select: { id: true },
        });
        const notifications = admins.map((admin) => ({
            userId: admin.id,
            title,
            message,
            type,
        }));
        return await prisma_1.default.notification.createMany({
            data: notifications,
        });
    }
    catch (err) {
        console.error('Failed to create admin notifications:', err);
        return null;
    }
};
exports.createAdminNotification = createAdminNotification;
const createNotificationsForUsers = async (userIds, title, message, type = 'INFO') => {
    try {
        const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
        if (uniqueUserIds.length === 0) {
            return null;
        }
        return await prisma_1.default.notification.createMany({
            data: uniqueUserIds.map((userId) => ({
                userId,
                title,
                message,
                type,
            })),
        });
    }
    catch (err) {
        console.error('Failed to create notifications:', err);
        return null;
    }
};
exports.createNotificationsForUsers = createNotificationsForUsers;
const notifyAdminsAndUser = async (userId, title, message, type = 'INFO') => {
    try {
        const admins = await prisma_1.default.user.findMany({
            where: { role: 'ADMIN' },
            select: { id: true },
        });
        return await (0, exports.createNotificationsForUsers)([userId, ...admins.map((admin) => admin.id)], title, message, type);
    }
    catch (err) {
        console.error('Failed to notify admins and user:', err);
        return null;
    }
};
exports.notifyAdminsAndUser = notifyAdminsAndUser;
const createHierarchyNotification = async (actorId, title, message, type = 'INFO') => {
    try {
        const users = await (0, userHierarchy_service_1.fetchHierarchyUsers)();
        const ancestorIds = (0, userHierarchy_service_1.getAncestorIds)(actorId, users);
        if (ancestorIds.length === 0)
            return null;
        const notifications = ancestorIds.map((id) => ({
            userId: id,
            title,
            message,
            type,
        }));
        return await prisma_1.default.notification.createMany({
            data: notifications,
        });
    }
    catch (err) {
        console.error('Failed to create hierarchy notifications:', err);
        return null;
    }
};
exports.createHierarchyNotification = createHierarchyNotification;
