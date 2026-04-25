"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeTransactionPin = exports.loginAs = exports.changePassword = exports.getMe = exports.login = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const userHierarchy_service_1 = require("../services/userHierarchy.service");
function buildPublicUserPayload(user) {
    return {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        profile: user.profile,
        wallet: user.wallet,
        transactionPinSet: Boolean(user.transactionPinHash),
    };
}
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
            user: buildPublicUserPayload(user),
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
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        res.json({ success: true, user: buildPublicUserPayload(user) });
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
    try {
        const hierarchyUsers = await (0, userHierarchy_service_1.fetchHierarchyUsers)();
        if (!(0, userHierarchy_service_1.canManageTarget)(req.user, userId, hierarchyUsers)) {
            res.status(403).json({ success: false, message: 'Forbidden: You cannot login as this user' });
            return;
        }
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
            user: buildPublicUserPayload(targetUser),
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.loginAs = loginAs;
const changeTransactionPin = async (req, res) => {
    const { currentPin, newPin, confirmPin } = req.body;
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                transactionPinHash: true,
            },
        });
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        const normalizedNewPin = typeof newPin === 'string' ? newPin.trim() : '';
        const normalizedConfirmPin = typeof confirmPin === 'string' ? confirmPin.trim() : '';
        const normalizedCurrentPin = typeof currentPin === 'string' ? currentPin.trim() : '';
        if (!/^\d{4,6}$/.test(normalizedNewPin)) {
            res.status(400).json({ success: false, message: 'Transaction PIN must be 4 to 6 digits' });
            return;
        }
        if (normalizedNewPin !== normalizedConfirmPin) {
            res.status(400).json({ success: false, message: 'Transaction PIN confirmation does not match' });
            return;
        }
        if (user.transactionPinHash) {
            if (!normalizedCurrentPin) {
                res.status(400).json({ success: false, message: 'Current Transaction PIN is required' });
                return;
            }
            const matches = await bcryptjs_1.default.compare(normalizedCurrentPin, user.transactionPinHash);
            if (!matches) {
                res.status(400).json({ success: false, message: 'Current Transaction PIN is incorrect' });
                return;
            }
        }
        const transactionPinHash = await bcryptjs_1.default.hash(normalizedNewPin, 10);
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: {
                transactionPinHash,
                transactionPinUpdatedAt: new Date(),
            },
        });
        res.json({ success: true, message: 'Transaction PIN updated successfully', transactionPinSet: true });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.changeTransactionPin = changeTransactionPin;
