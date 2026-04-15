"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Seeding database...');
    const passwordHash = await bcryptjs_1.default.hash('admin123', 10);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@abheepay.com' },
        update: {},
        create: {
            email: 'admin@abheepay.com',
            passwordHash,
            role: 'ADMIN',
            profile: {
                create: {
                    ownerName: 'Super Admin',
                    shopName: 'AbheePay HQ',
                    mobileNumber: '9999999999',
                    fullAddress: 'Mumbai, Maharashtra',
                    state: 'Maharashtra',
                    pinCode: '400001',
                },
            },
            wallet: { create: { balance: 0 } },
        },
    });
    // Mocked users
    const mockUsers = [
        {
            email: 'super1@abheepay.com',
            role: 'SUPER',
            ownerName: 'Rajesh Kumar',
            shopName: 'RK Super Distributors',
            mobileNumber: '9876543210',
            state: 'Delhi',
            balance: 50000,
        },
        {
            email: 'distributor1@abheepay.com',
            role: 'DISTRIBUTOR',
            ownerName: 'Priya Singh',
            shopName: 'Prime Distribution Hub',
            mobileNumber: '9765432109',
            state: 'Karnataka',
            balance: 25000,
        },
        {
            email: 'retailer1@abheepay.com',
            role: 'RETAILER',
            ownerName: 'Amit Patel',
            shopName: 'Amit General Store',
            mobileNumber: '9654321098',
            state: 'Gujarat',
            balance: 10000,
        },
        {
            email: 'retailer2@abheepay.com',
            role: 'RETAILER',
            ownerName: 'Neha Gupta',
            shopName: 'Neha Mobile Store',
            mobileNumber: '9543210987',
            state: 'Rajasthan',
            balance: 15000,
        },
        {
            email: 'distributor2@abheepay.com',
            role: 'DISTRIBUTOR',
            ownerName: 'Vikram Sharma',
            shopName: 'Vikram Enterprises',
            mobileNumber: '9432109876',
            state: 'Punjab',
            balance: 35000,
        },
    ];
    for (const user of mockUsers) {
        await prisma.user.upsert({
            where: { email: user.email },
            update: {},
            create: {
                email: user.email,
                passwordHash,
                role: user.role,
                parentId: admin.id,
                profile: {
                    create: {
                        ownerName: user.ownerName,
                        shopName: user.shopName,
                        mobileNumber: user.mobileNumber,
                        fullAddress: 'Address pending',
                        state: user.state,
                        pinCode: '000000',
                        aadhaarNumber: '0000000000000000',
                    },
                },
                wallet: { create: { balance: user.balance } },
            },
        });
    }
    // Default commission slabs
    const existingAdminSlabs = await prisma.commissionSlab.count({
        where: { setById: admin.id },
    });
    if (existingAdminSlabs === 0) {
        await prisma.commissionSlab.createMany({
            data: [
                { setById: admin.id, serviceType: 'PAYOUT', applyOnRole: 'SUPER', commissionType: 'FLAT', commissionValue: 5, minAmount: 100, maxAmount: 5000 },
                { setById: admin.id, serviceType: 'PAYOUT', applyOnRole: 'SUPER', commissionType: 'FLAT', commissionValue: 15, minAmount: 5001, maxAmount: 25000 },
                { setById: admin.id, serviceType: 'PAYOUT', applyOnRole: 'SUPER', commissionType: 'FLAT', commissionValue: 25, minAmount: 25001, maxAmount: 50000 },
                { setById: admin.id, serviceType: 'PAYOUT', applyOnRole: 'SUPER', commissionType: 'FLAT', commissionValue: 40, minAmount: 50001, maxAmount: 100000 },
                { setById: admin.id, serviceType: 'FUND_REQUEST', applyOnRole: 'SUPER', commissionType: 'FLAT', commissionValue: 5, minAmount: 100, maxAmount: 5000 },
                { setById: admin.id, serviceType: 'FUND_REQUEST', applyOnRole: 'SUPER', commissionType: 'FLAT', commissionValue: 15, minAmount: 5001, maxAmount: 25000 },
            ],
        });
    }
    await prisma.bankVerificationFee.upsert({
        where: { id: 'BANK_VERIFICATION' },
        create: {
            id: 'BANK_VERIFICATION',
            amount: 10,
        },
        update: {
            amount: 10,
        },
    });
    const existingBankAccounts = await prisma.companyBankAccount.count();
    if (existingBankAccounts === 0) {
        await prisma.companyBankAccount.create({
            data: {
                bankName: 'AbheePay Company Bank',
                accountNumber: '999999999999',
                ifscCode: 'ABCD0000001',
                isActive: true,
                createdById: admin.id,
                updatedById: admin.id,
            },
        });
    }
    console.log(`✅ Admin created: admin@abheepay.com / admin123`);
    console.log(`✅ 5 mocked users created (password: admin123)`);
    console.log(`  - super1@abheepay.com (SUPER)`);
    console.log(`  - distributor1@abheepay.com (DISTRIBUTOR)`);
    console.log(`  - retailer1@abheepay.com (RETAILER)`);
    console.log(`  - retailer2@abheepay.com (RETAILER)`);
    console.log(`  - distributor2@abheepay.com (DISTRIBUTOR)`);
    console.log('✅ Default commission slabs inserted');
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
