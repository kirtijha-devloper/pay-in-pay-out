"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginAs = exports.changePassword = exports.getMe = exports.login = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const login = async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    try {
        const user = await prisma_1.default.user.findFirst({
            where: {
                email: {
                    equals: normalizedEmail,
                    mode: 'insensitive',
                },
            },
            include: { profile: true, wallet: true },
        });
        if (!user) {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
            return;
        }
        const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!valid) {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
            return;
        }
        if (!user.isActive) {
            res.status(403).json({ success: false, message: 'Account is deactivated' });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
                profile: user.profile,
                wallet: user.wallet,
            },
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.login = login;
const getMe = async (req, res) => {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.user.id },
            include: { profile: true, wallet: true },
        });
        res.json({ success: true, user });
    }
    catch {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getMe = getMe;
const changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    try {
        const user = await prisma_1.default.user.findUnique({ where: { id: req.user.id } });
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        const valid = await bcryptjs_1.default.compare(oldPassword, user.passwordHash);
        if (!valid) {
            res.status(400).json({ success: false, message: 'Current password is incorrect' });
            return;
        }
        const passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
        await prisma_1.default.user.update({ where: { id: user.id }, data: { passwordHash } });
        res.json({ success: true, message: 'Password changed successfully' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.changePassword = changePassword;
const loginAs = async (req, res) => {
    const { userId } = req.body;
    // Only admin can login as another user
    if (req.user.role !== 'ADMIN') {
        res.status(403).json({ success: false, message: 'Only admins can login as other users' });
        return;
    }
    try {
        const targetUser = await prisma_1.default.user.findUnique({
            where: { id: userId },
            include: { profile: true, wallet: true },
        });
        if (!targetUser) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        if (!targetUser.isActive) {
            res.status(403).json({ success: false, message: 'Target user account is deactivated' });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ id: targetUser.id, role: targetUser.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({
            success: true,
            token,
            user: {
                id: targetUser.id,
                email: targetUser.email,
                role: targetUser.role,
                isActive: targetUser.isActive,
                profile: targetUser.profile,
                wallet: targetUser.wallet,
            },
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.loginAs = loginAs;
