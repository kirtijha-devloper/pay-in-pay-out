"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setUserOverride = exports.getUserOverrides = exports.deleteSlab = exports.upsertSlab = exports.getSlabs = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const getSlabs = async (req, res) => {
    try {
        const slabs = await prisma_1.default.commissionSlab.findMany({ orderBy: { minAmount: 'asc' } });
        res.json({ success: true, slabs });
    }
    catch {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getSlabs = getSlabs;
const upsertSlab = async (req, res) => {
    const { id, serviceType, applyOnRole, commissionType, commissionValue, minAmount, maxAmount, isActive } = req.body;
    try {
        const slab = id
            ? await prisma_1.default.commissionSlab.update({
                where: { id },
                data: { serviceType, applyOnRole, commissionType, commissionValue, minAmount, maxAmount, isActive },
            })
            : await prisma_1.default.commissionSlab.create({
                data: { serviceType, applyOnRole: applyOnRole, commissionType, commissionValue, minAmount, maxAmount, isActive },
            });
        res.json({ success: true, slab });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.upsertSlab = upsertSlab;
const deleteSlab = async (req, res) => {
    try {
        await prisma_1.default.commissionSlab.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    }
    catch {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.deleteSlab = deleteSlab;
const getUserOverrides = async (req, res) => {
    try {
        const overrides = await prisma_1.default.userCommissionSetup.findMany({
            where: { setById: req.user.id },
            include: { targetUser: { include: { profile: true } } },
        });
        res.json({ success: true, overrides });
    }
    catch {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getUserOverrides = getUserOverrides;
const setUserOverride = async (req, res) => {
    const { targetUserId, serviceType, commissionType, commissionValue, minAmount, maxAmount } = req.body;
    try {
        const override = await prisma_1.default.userCommissionSetup.upsert({
            where: { setById_targetUserId_serviceType: { setById: req.user.id, targetUserId, serviceType } },
            create: { setById: req.user.id, targetUserId, serviceType, commissionType, commissionValue, minAmount, maxAmount },
            update: { commissionType, commissionValue, minAmount, maxAmount },
        });
        res.json({ success: true, override });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.setUserOverride = setUserOverride;
