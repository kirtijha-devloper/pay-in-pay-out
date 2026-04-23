const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.companyBankAccount.findMany();
  console.log('Company Bank Accounts:', JSON.stringify(accounts, null, 2));
  
  const users = await prisma.user.findMany({
    where: { NOT: { qrCodePath: null } }
  });
  console.log('Users with QR:', JSON.stringify(users, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
