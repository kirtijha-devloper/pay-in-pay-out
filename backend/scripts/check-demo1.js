const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ 
    where: { 
      OR: [
        { email: { contains: 'demo1' } },
        { profile: { ownerName: { contains: 'demo1' } } }
      ]
    },
    include: { profile: true }
  });
  
  if (!user) return console.log('User demo1 not found');
  
  const transactions = await prisma.walletTransaction.findMany({
    where: { 
      OR: [
        { receiverId: user.id },
        { senderId: user.id }
      ]
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  
  console.log('User:', user.email, 'Owner:', user.profile?.ownerName);
  console.log('Transactions Count:', transactions.length);
  console.log('Sample Transactions:', JSON.stringify(transactions.slice(0, 10), null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
