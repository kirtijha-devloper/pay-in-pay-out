const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { role: 'RETAILER' } });
  if (!user) return console.log('No Retailer found');
  
  const transactions = await prisma.walletTransaction.findMany({
    where: { receiverId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  
  console.log('User:', user.email);
  console.log('Transactions:', JSON.stringify(transactions, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
