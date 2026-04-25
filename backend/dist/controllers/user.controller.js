"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateWalletHold = exports.rejectKycRequest = exports.approveKycRequest = exports.getKycRequests = exports.getMyKycRequest = exports.submitKycRequest = exports.updateKycStatus = exports.updateProfile = exports.deleteUser = exports.updateUser = exports.toggleUserStatus = exports.getUserById = exports.searchUsers = exports.getUsers = exports.createUser = void 0;
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const userHierarchy_service_1 = require("../services/userHierarchy.service");
const notification_service_1 = require("../services/notification.service");
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
const KYC_REQUEST_INCLUDE = {
    user: {
        select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            kycStatus: true,
            profile: {
                select: {
                    ownerName: true,
                    shopName: true,
                    mobileNumber: true,
                    aadhaarNumber: true,
                },
            },
        },
    },
    reviewedBy: {
        select: {
            id: true,
            email: true,
            role: true,
        },
    },
};
function normalizeKycStatus(status) {
    const value = String(status || '').toUpperCase();
    if (value === 'VERIFIED')
        return client_1.KycStatus.VERIFIED;
    if (value === 'REJECTED')
        return client_1.KycStatus.REJECTED;
    return client_1.KycStatus.PENDING;
}
function serializeKycRequest(request) {
    if (!request)
        return null;
    let dateOfBirth = '';
    if (request.dateOfBirth) {
        const parsedDate = new Date(request.dateOfBirth);
        dateOfBirth = Number.isNaN(parsedDate.getTime())
            ? String(request.dateOfBirth)
            : parsedDate.toISOString().slice(0, 10);
    }
    return {
        ...request,
        dateOfBirth,
    };
}
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
                parentId: req.body.parentId || req.user.id,
                profile: {
                    create: {
                        ownerName: ownerName || normalizedEmail.split('@')[0],
                        shopName: shopName || `${normalizedEmail.split('@')[0]}'s Shop`,
                        mobileNumber: mobileNumber || `0000${Math.floor(Math.random() * 1000000)}`, // Fallback for testing
                        fullAddress: fullAddress || 'Address N/A',
                        state: state || 'State N/A',
                        pinCode: pinCode || '000000',
                        aadhaarNumber: aadhaarNumber || null,
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
        await (0, notification_service_1.notifyAdminsAndUser)(user.id, 'New User Created', `${user.email} (${user.role}) account has been created by ${req.user.role}.`, 'SUCCESS');
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
    const search = req.query.search;
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
        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { profile: { ownerName: { contains: search, mode: 'insensitive' } } },
                { profile: { shopName: { contains: search, mode: 'insensitive' } } },
                { profile: { mobileNumber: { contains: search, mode: 'insensitive' } } },
            ];
        }
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
const searchUsers = async (req, res) => {
    const query = req.query.q;
    if (!query) {
        res.json({ success: true, users: [] });
        return;
    }
    try {
        const hierarchyUsers = await (0, userHierarchy_service_1.fetchHierarchyUsers)();
        const visibleUserIds = (0, userHierarchy_service_1.getDescendantIds)(req.user.id, hierarchyUsers);
        if (visibleUserIds.length === 0) {
            res.json({ success: true, users: [] });
            return;
        }
        const users = await prisma_1.default.user.findMany({
            where: {
                id: { in: visibleUserIds },
                OR: [
                    { email: { contains: query, mode: 'insensitive' } },
                    { profile: { ownerName: { contains: query, mode: 'insensitive' } } },
                    { profile: { shopName: { contains: query, mode: 'insensitive' } } },
                    { profile: { mobileNumber: { contains: query, mode: 'insensitive' } } },
                ],
            },
            take: 10,
            include: { profile: true },
        });
        res.json({
            success: true,
            users: users.map((u) => ({
                id: u.id,
                email: u.email,
                role: u.role,
                ownerName: u.profile?.ownerName,
                shopName: u.profile?.shopName,
            })),
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.searchUsers = searchUsers;
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
        await (0, notification_service_1.notifyAdminsAndUser)(targetUserId, 'Account Status Updated', `Your account has been ${updated.isActive ? 'activated' : 'deactivated'} by ${req.user.role}.`, updated.isActive ? 'SUCCESS' : 'WARNING');
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
        await (0, notification_service_1.notifyAdminsAndUser)(targetUserId, 'Profile Updated', `Your profile details were updated by ${req.user.role}.`, 'INFO');
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
        const hierarchyUsers = await (0, userHierarchy_service_1.fetchHierarchyUsers)();
        const targetUserId = req.params.id;
        if (!(0, userHierarchy_service_1.canManageTarget)(req.user, targetUserId, hierarchyUsers)) {
            res.status(403).json({ success: false, message: 'Forbidden: You cannot manage this user' });
            return;
        }
        const deletedUser = await prisma_1.default.user.update({
            where: { id: targetUserId },
            data: { isActive: false },
        });
        await (0, notification_service_1.notifyAdminsAndUser)(targetUserId, 'Account Deactivated', `${deletedUser.email} has been deactivated by ${req.user.role}.`, 'WARNING');
        res.json({ success: true, message: 'User deactivated (soft deleted)' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.deleteUser = deleteUser;
const updateProfile = async (req, res) => {
    const { ownerName, shopName, fullAddress, state, pinCode, bankName, accountNumber, accountName, ifscCode, tpin, } = req.body;
    try {
        const userId = req.user.id;
        const isUpdatingBank = bankName || accountNumber || accountName || ifscCode;
        if (isUpdatingBank) {
            if (!tpin) {
                res.status(400).json({
                    success: false,
                    message: 'Transaction PIN is required to update bank details',
                });
                return;
            }
            const userExists = await prisma_1.default.user.findUnique({
                where: { id: userId },
                select: { transactionPinHash: true },
            });
            if (!userExists?.transactionPinHash) {
                res.status(400).json({
                    success: false,
                    message: 'Please set your Transaction PIN in security settings first',
                });
                return;
            }
            const validPin = await bcryptjs_1.default.compare(String(tpin), userExists.transactionPinHash);
            if (!validPin) {
                res.status(400).json({ success: false, message: 'Invalid Transaction PIN' });
                return;
            }
        }
        const profile = await prisma_1.default.profile.update({
            where: { userId },
            data: {
                ownerName,
                shopName,
                fullAddress,
                state,
                pinCode,
                bankName,
                accountNumber,
                accountName,
                ifscCode,
            },
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
        await (0, notification_service_1.notifyAdminsAndUser)(targetUserId, 'KYC Status Updated', `Your KYC status is now ${updated.kycStatus}.`, updated.kycStatus === client_1.KycStatus.VERIFIED ? 'SUCCESS' : 'WARNING');
        res.json({ success: true, kycStatus: updated.kycStatus });
    }
    catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.updateKycStatus = updateKycStatus;
const submitKycRequest = async (req, res) => {
    const { fullName, dateOfBirth, gender, aadhaarNumber, panNumber } = req.body;
    const photoFile = req.file;
    try {
        const currentUser = await prisma_1.default.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, kycStatus: true },
        });
        if (!currentUser) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        if (currentUser.kycStatus === client_1.KycStatus.VERIFIED) {
            res.status(409).json({ success: false, message: 'KYC is already verified' });
            return;
        }
        if (!fullName || !dateOfBirth || !gender || !aadhaarNumber || !panNumber) {
            res.status(400).json({
                success: false,
                message: 'Full name, date of birth, gender, Aadhaar number, and PAN number are required',
            });
            return;
        }
        const parsedDateOfBirth = new Date(dateOfBirth);
        if (Number.isNaN(parsedDateOfBirth.getTime())) {
            res.status(400).json({ success: false, message: 'Date of birth must be a valid date' });
            return;
        }
        const normalizedGender = String(gender).trim().toUpperCase();
        if (!['MALE', 'FEMALE', 'OTHER'].includes(normalizedGender)) {
            res.status(400).json({ success: false, message: 'Gender must be MALE, FEMALE, or OTHER' });
            return;
        }
        const existingPending = await prisma_1.default.kycRequest.findFirst({
            where: {
                userId: req.user.id,
                status: client_1.KycStatus.PENDING,
            },
            orderBy: { createdAt: 'desc' },
        });
        if (existingPending) {
            res.status(409).json({
                success: false,
                message: 'You already have a pending KYC request',
                request: serializeKycRequest(existingPending),
            });
            return;
        }
        const request = await prisma_1.default.$transaction(async (tx) => {
            const created = await tx.kycRequest.create({
                data: {
                    userId: req.user.id,
                    fullName: String(fullName).trim(),
                    dateOfBirth: parsedDateOfBirth,
                    gender: normalizedGender,
                    aadhaarNumber: String(aadhaarNumber).trim(),
                    panNumber: String(panNumber).trim().toUpperCase(),
                    kycPhotoPath: photoFile?.path,
                    status: client_1.KycStatus.PENDING,
                },
                include: KYC_REQUEST_INCLUDE,
            });
            await tx.user.update({
                where: { id: req.user.id },
                data: { kycStatus: client_1.KycStatus.PENDING },
            });
            return created;
        });
        await (0, notification_service_1.notifyAdminsAndUser)(req.user.id, 'KYC Request Submitted', `${req.user.role} submitted a KYC request for review.`, 'INFO');
        res.status(201).json({
            success: true,
            message: 'KYC request submitted for admin review',
            request: serializeKycRequest(request),
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.submitKycRequest = submitKycRequest;
const getMyKycRequest = async (req, res) => {
    try {
        const requests = await prisma_1.default.kycRequest.findMany({
            where: { userId: req.user.id },
            include: KYC_REQUEST_INCLUDE,
            orderBy: { createdAt: 'desc' },
        });
        res.json({
            success: true,
            requests: requests.map(serializeKycRequest),
            request: serializeKycRequest(requests[0] || null),
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getMyKycRequest = getMyKycRequest;
const getKycRequests = async (req, res) => {
    try {
        const status = req.query.status;
        const where = {};
        if (status) {
            where.status = normalizeKycStatus(status);
        }
        const requests = await prisma_1.default.kycRequest.findMany({
            where,
            include: KYC_REQUEST_INCLUDE,
            orderBy: { createdAt: 'desc' },
        });
        res.json({
            success: true,
            requests: requests.map(serializeKycRequest),
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getKycRequests = getKycRequests;
async function reviewKycRequest(req, res, status) {
    const id = req.params.id;
    const reviewRemark = String(req.body?.reviewRemark || req.body?.remark || '').trim();
    try {
        const request = await prisma_1.default.kycRequest.findUnique({
            where: { id },
            include: {
                user: { include: { profile: true } },
            },
        });
        if (!request) {
            res.status(404).json({ success: false, message: 'KYC request not found' });
            return;
        }
        if (request.status !== client_1.KycStatus.PENDING) {
            res.status(400).json({ success: false, message: 'This KYC request has already been reviewed' });
            return;
        }
        const updated = await prisma_1.default.$transaction(async (tx) => {
            const savedRequest = await tx.kycRequest.update({
                where: { id },
                data: {
                    status,
                    reviewedById: req.user.id,
                    reviewedAt: new Date(),
                    reviewRemark: reviewRemark || null,
                },
            });
            await tx.user.update({
                where: { id: request.userId },
                data: {
                    kycStatus: status,
                },
            });
            if (status === client_1.KycStatus.VERIFIED) {
                await tx.profile.upsert({
                    where: { userId: request.userId },
                    create: {
                        userId: request.userId,
                        ownerName: request.fullName,
                        shopName: request.user.profile?.shopName || request.fullName,
                        mobileNumber: request.user.profile?.mobileNumber || request.user.email || request.userId,
                        fullAddress: request.user.profile?.fullAddress || '-',
                        state: request.user.profile?.state || '-',
                        pinCode: request.user.profile?.pinCode || '-',
                        aadhaarNumber: request.aadhaarNumber,
                    },
                    update: {
                        ownerName: request.fullName,
                        aadhaarNumber: request.aadhaarNumber,
                    },
                });
            }
            return tx.kycRequest.findUnique({
                where: { id },
                include: KYC_REQUEST_INCLUDE,
            });
        });
        await (0, notification_service_1.notifyAdminsAndUser)(request.userId, status === client_1.KycStatus.VERIFIED ? 'KYC Approved' : 'KYC Rejected', status === client_1.KycStatus.VERIFIED
            ? `Your KYC request has been approved by ${req.user.role}.`
            : `Your KYC request has been rejected by ${req.user.role}.${reviewRemark ? ` Remark: ${reviewRemark}` : ''}`, status === client_1.KycStatus.VERIFIED ? 'SUCCESS' : 'WARNING');
        res.json({
            success: true,
            message: status === client_1.KycStatus.VERIFIED ? 'KYC approved' : 'KYC rejected',
            request: serializeKycRequest(updated),
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
const approveKycRequest = async (req, res) => {
    await reviewKycRequest(req, res, client_1.KycStatus.VERIFIED);
};
exports.approveKycRequest = approveKycRequest;
const rejectKycRequest = async (req, res) => {
    await reviewKycRequest(req, res, client_1.KycStatus.REJECTED);
};
exports.rejectKycRequest = rejectKycRequest;
const updateWalletHold = async (req, res) => {
    const { minimumHold } = req.body;
    const targetUserId = req.params.id;
    try {
        const hierarchyUsers = await (0, userHierarchy_service_1.fetchHierarchyUsers)();
        if (!(0, userHierarchy_service_1.canManageTarget)(req.user, targetUserId, hierarchyUsers)) {
            res.status(403).json({ success: false, message: 'Forbidden: You cannot manage this user' });
            return;
        }
        const updated = await prisma_1.default.wallet.update({
            where: { userId: targetUserId },
            data: { minimumHold: new client_1.Prisma.Decimal(minimumHold) },
        });
        await (0, notification_service_1.notifyAdminsAndUser)(targetUserId, 'Wallet Hold Updated', `Your minimum wallet hold has been updated to Rs ${minimumHold} by ${req.user.role}.`, 'INFO');
        res.json({ success: true, minimumHold: updated.minimumHold });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.updateWalletHold = updateWalletHold;
