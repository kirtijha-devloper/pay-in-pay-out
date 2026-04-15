"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateKycStatus = exports.updateProfile = exports.deleteUser = exports.updateUser = exports.toggleUserStatus = exports.getUserById = exports.getUsers = exports.createUser = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const userHierarchy_service_1 = require("../services/userHierarchy.service");
const CREATION_PERMISSIONS = {
    ADMIN: ['SUPER', 'DISTRIBUTOR', 'RETAILER'],
    SUPER: ['DISTRIBUTOR', 'RETAILER'],
    DISTRIBUTOR: ['RETAILER'],
};
const sanitizeUser = (user) => {
    const { passwordHash, children, ...safeUser } = user;
    if (!children) {
        return safeUser;
    }
    return {
        ...safeUser,
        children: children.map(sanitizeUser),
    };
};
const createUser = async (req, res) => {
    const { email, password, role, ownerName, shopName, mobileNumber, fullAddress, state, pinCode, aadhaarNumber, } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const creatorRole = req.user.role;
    const allowed = CREATION_PERMISSIONS[creatorRole] || [];
    if (!allowed.includes(role)) {
        res.status(403).json({ success: false, message: `${creatorRole} cannot create ${role}` });
        return;
    }
    try {
        const exists = await prisma_1.default.user.findFirst({
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
        const mobileExists = await prisma_1.default.profile.findUnique({ where: { mobileNumber } });
        if (mobileExists) {
            res.status(409).json({ success: false, message: 'Mobile number already exists' });
            return;
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const files = req.files;
        const user = await prisma_1.default.user.create({
            data: {
                email: normalizedEmail,
                passwordHash,
                role: role,
                parentId: req.user.id,
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
        const hierarchyUsers = await (0, userHierarchy_service_1.fetchHierarchyUsers)();
        res.status(201).json({
            success: true,
            user: sanitizeUser((0, userHierarchy_service_1.decorateUserWithHierarchy)(user, hierarchyUsers)),
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.createUser = createUser;
const getUsers = async (req, res) => {
    const filterRole = req.query.role;
    const status = req.query.status;
    const page = req.query.page || '1';
    const limit = req.query.limit || '20';
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);
    try {
        const hierarchyUsers = await (0, userHierarchy_service_1.fetchHierarchyUsers)();
        const visibleUserIds = (0, userHierarchy_service_1.getDescendantIds)(req.user.id, hierarchyUsers);
        if (visibleUserIds.length === 0) {
            res.json({ success: true, users: [], total: 0, page: parseInt(page, 10), limit: take });
            return;
        }
        const where = {
            id: { in: visibleUserIds },
        };
        if (filterRole)
            where.role = filterRole;
        if (status === 'active')
            where.isActive = true;
        if (status === 'inactive')
            where.isActive = false;
        const [users, total] = await Promise.all([
            prisma_1.default.user.findMany({
                where,
                skip,
                take,
                include: { profile: true, wallet: true },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.default.user.count({ where }),
        ]);
        res.json({
            success: true,
            users: (0, userHierarchy_service_1.decorateUsersWithHierarchy)(users, hierarchyUsers).map(sanitizeUser),
            total,
            page: parseInt(page, 10),
            limit: take,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getUsers = getUsers;
const getUserById = async (req, res) => {
    try {
        const hierarchyUsers = await (0, userHierarchy_service_1.fetchHierarchyUsers)();
        const targetUserId = req.params.id;
        const targetExists = hierarchyUsers.some((user) => user.id === targetUserId);
        if (!targetExists) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        if (!(0, userHierarchy_service_1.canManageTarget)(req.user, targetUserId, hierarchyUsers)) {
            res.status(403).json({ success: false, message: 'Forbidden' });
            return;
        }
        const user = await prisma_1.default.user.findUnique({
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
            user: sanitizeUser((0, userHierarchy_service_1.decorateUserWithHierarchy)(user, hierarchyUsers)),
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getUserById = getUserById;
const toggleUserStatus = async (req, res) => {
    try {
        const hierarchyUsers = await (0, userHierarchy_service_1.fetchHierarchyUsers)();
        const targetUserId = req.params.id;
        const targetExists = hierarchyUsers.some((user) => user.id === targetUserId);
        if (!targetExists) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        if (!(0, userHierarchy_service_1.canManageTarget)(req.user, targetUserId, hierarchyUsers)) {
            res.status(403).json({ success: false, message: 'Forbidden' });
            return;
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: targetUserId } });
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        const updated = await prisma_1.default.user.update({
            where: { id: targetUserId },
            data: { isActive: !user.isActive },
        });
        res.json({ success: true, isActive: updated.isActive });
    }
    catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.toggleUserStatus = toggleUserStatus;
const updateUser = async (req, res) => {
    const { ownerName, shopName, mobileNumber, fullAddress, state, pinCode, aadhaarNumber } = req.body;
    try {
        const hierarchyUsers = await (0, userHierarchy_service_1.fetchHierarchyUsers)();
        const targetUserId = req.params.id;
        const targetExists = hierarchyUsers.some((user) => user.id === targetUserId);
        if (!targetExists) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        if (!(0, userHierarchy_service_1.canManageTarget)(req.user, targetUserId, hierarchyUsers)) {
            res.status(403).json({ success: false, message: 'Forbidden' });
            return;
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: targetUserId },
            include: { profile: true, wallet: true },
        });
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        const mobileExists = await prisma_1.default.profile.findFirst({
            where: {
                mobileNumber,
                userId: { not: targetUserId },
            },
        });
        if (mobileExists) {
            res.status(409).json({ success: false, message: 'Mobile number already exists' });
            return;
        }
        const profile = await prisma_1.default.profile.update({
            where: { userId: targetUserId },
            data: { ownerName, shopName, mobileNumber, fullAddress, state, pinCode, aadhaarNumber },
        });
        res.json({
            success: true,
            user: sanitizeUser((0, userHierarchy_service_1.decorateUserWithHierarchy)({
                ...user,
                profile,
            }, hierarchyUsers)),
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.updateUser = updateUser;
const deleteUser = async (req, res) => {
    try {
        await prisma_1.default.user.update({
            where: { id: req.params.id },
            data: { isActive: false },
        });
        res.json({ success: true, message: 'User deactivated (soft deleted)' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.deleteUser = deleteUser;
const updateProfile = async (req, res) => {
    const { ownerName, shopName, fullAddress, state, pinCode } = req.body;
    try {
        const profile = await prisma_1.default.profile.update({
            where: { userId: req.user.id },
            data: { ownerName, shopName, fullAddress, state, pinCode },
        });
        res.json({ success: true, profile });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.updateProfile = updateProfile;
const updateKycStatus = async (req, res) => {
    const { status } = req.body;
    const targetUserId = req.params.id;
    if (req.user.role !== 'ADMIN') {
        res.status(403).json({ success: false, message: 'Only admins can update KYC status' });
        return;
    }
    try {
        const updated = await prisma_1.default.user.update({
            where: { id: targetUserId },
            data: { kycStatus: status },
        });
        res.json({ success: true, kycStatus: updated.kycStatus });
    }
    catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.updateKycStatus = updateKycStatus;
