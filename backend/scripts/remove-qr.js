const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up QR data from database...');

  // 1. Delete company bank accounts that are specifically for QR (e.g., bankName='upi' or accountNumber starts with QR-)
  const deletedAccounts = await prisma.companyBankAccount.deleteMany({
    where: {
      OR: [
        { bankName: { equals: 'upi', mode: 'insensitive' } },
        { accountNumber: { startsWith: 'QR-' } },
        { NOT: { qrCodePath: null } }
      ]
    }
  });
  console.log(`Deleted ${deletedAccounts.count} QR-specific bank accounts.`);

  // 2. Clear qrCodePath for any remaining accounts (just in case)
  const clearedPaths = await prisma.companyBankAccount.updateMany({
    data: {
      qrCodePath: null
    }
  });
  console.log(`Cleared qrCodePath for all remaining ${clearedPaths.count} bank accounts.`);

  // 3. Clear qrCodePath for Users
  const clearedUsers = await prisma.user.updateMany({
    data: {
      qrCodePath: null
    }
  });
  console.log(`Cleared qrCodePath for ${clearedUsers.count} users.`);

  console.log('Database cleanup complete.');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
