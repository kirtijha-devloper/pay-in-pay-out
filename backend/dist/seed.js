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
    // Default commission slabs
    await prisma.commissionSlab.createMany({
        skipDuplicates: true,
        data: [
            { serviceType: 'PAYOUT', applyOnRole: 'SUPER', commissionType: 'FLAT', commissionValue: 5, minAmount: 100, maxAmount: 5000 },
            { serviceType: 'PAYOUT', applyOnRole: 'SUPER', commissionType: 'FLAT', commissionValue: 15, minAmount: 5001, maxAmount: 25000 },
            { serviceType: 'PAYOUT', applyOnRole: 'SUPER', commissionType: 'FLAT', commissionValue: 25, minAmount: 25001, maxAmount: 50000 },
            { serviceType: 'PAYOUT', applyOnRole: 'SUPER', commissionType: 'FLAT', commissionValue: 40, minAmount: 50001, maxAmount: 100000 },
            { serviceType: 'BANK_VERIFICATION', applyOnRole: 'SUPER', commissionType: 'FLAT', commissionValue: 10 },
            { serviceType: 'FUND_REQUEST', applyOnRole: 'SUPER', commissionType: 'FLAT', commissionValue: 5, minAmount: 100, maxAmount: 5000 },
            { serviceType: 'FUND_REQUEST', applyOnRole: 'SUPER', commissionType: 'FLAT', commissionValue: 15, minAmount: 5001, maxAmount: 25000 },
        ],
    });
    console.log(`✅ Admin created: admin@abheepay.com / admin123`);
    console.log('✅ Default commission slabs inserted');
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
