"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfile = exports.deleteUser = exports.updateUser = exports.toggleUserStatus = exports.getUserById = exports.getUsers = exports.createUser = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = __importDefault(require("../lib/prisma"));
// who can create which roles
const CREATION_PERMISSIONS = {
    ADMIN: ['SUPER', 'DISTRIBUTOR', 'RETAILER'],
    SUPER: ['DISTRIBUTOR', 'RETAILER'],
    DISTRIBUTOR: ['RETAILER'],
};
const createUser = async (req, res) => {
    const { email, password, role, ownerName, shopName, mobileNumber, fullAddress, state, pinCode, aadhaarNumber, } = req.body;
    const creatorRole = req.user.role;
    const allowed = CREATION_PERMISSIONS[creatorRole] || [];
    if (!allowed.includes(role)) {
        res.status(403).json({ success: false, message: `${creatorRole} cannot create ${role}` });
        return;
    }
    try {
        const exists = await prisma_1.default.user.findUnique({ where: { email } });
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
                email,
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
                        aadhaarFrontPath: files?.['aadhaarFront']?.[0]?.path,
                        aadhaarBackPath: files?.['aadhaarBack']?.[0]?.path,
                        panCardPath: files?.['panCard']?.[0]?.path,
                    },
                },
                wallet: { create: {} },
            },
            include: { profile: true, wallet: true },
        });
        res.status(201).json({ success: true, user });
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
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    // Build hierarchy filter — all downline of current user
    const where = { parentId: req.user.id };
    if (filterRole)
        where.role = filterRole;
    if (status === 'active')
        where.isActive = true;
    if (status === 'inactive')
        where.isActive = false;
    // Admin sees all
    if (req.user.role === 'ADMIN')
        delete where.parentId;
    try {
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
        res.json({ success: true, users, total, page: parseInt(page), limit: take });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getUsers = getUsers;
const getUserById = async (req, res) => {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.params.id },
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
        res.json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getUserById = getUserById;
const toggleUserStatus = async (req, res) => {
    try {
        const user = await prisma_1.default.user.findUnique({ where: { id: req.params.id } });
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        const updated = await prisma_1.default.user.update({
            where: { id: req.params.id },
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
    const { ownerName, shopName, mobileNumber, fullAddress, state, pinCode } = req.body;
    try {
        const profile = await prisma_1.default.profile.update({
            where: { userId: req.params.id },
            data: { ownerName, shopName, mobileNumber, fullAddress, state, pinCode },
        });
        res.json({ success: true, profile });
    }
    catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.updateUser = updateUser;
const deleteUser = async (req, res) => {
    try {
        // soft delete
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
