import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash('admin123', 10);

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
      role: 'SUPER' as const,
      ownerName: 'Rajesh Kumar',
      shopName: 'RK Super Distributors',
      mobileNumber: '9876543210',
      state: 'Delhi',
      balance: 50000,
    },
    {
      email: 'distributor1@abheepay.com',
      role: 'DISTRIBUTOR' as const,
      ownerName: 'Priya Singh',
      shopName: 'Prime Distribution Hub',
      mobileNumber: '9765432109',
      state: 'Karnataka',
      balance: 25000,
    },
    {
      email: 'retailer1@abheepay.com',
      role: 'RETAILER' as const,
      ownerName: 'Amit Patel',
      shopName: 'Amit General Store',
      mobileNumber: '9654321098',
      state: 'Gujarat',
      balance: 10000,
    },
    {
      email: 'retailer2@abheepay.com',
      role: 'RETAILER' as const,
      ownerName: 'Neha Gupta',
      shopName: 'Neha Mobile Store',
      mobileNumber: '9543210987',
      state: 'Rajasthan',
      balance: 15000,
    },
    {
      email: 'distributor2@abheepay.com',
      role: 'DISTRIBUTOR' as const,
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
