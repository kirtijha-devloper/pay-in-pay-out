const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userEmail = 'admin@example.com'; // From my previous check for demo1
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) return console.log('User not found');

  const startTime = new Date();
  startTime.setDate(startTime.getDate() - 15);
  const endTime = new Date();

  console.log('User ID:', user.id);
  console.log('Range:', startTime.toISOString(), 'to', endTime.toISOString());

  const chargeStats = await prisma.walletTransaction.aggregate({
    _sum: { amount: true },
    where: {
      type: 'DEBIT',
      receiverId: user.id,
      description: { 
        contains: 'Charge',
        mode: 'insensitive'
      },
      createdAt: { gte: startTime, lte: endTime }
    }
  });

  const allCharges = await prisma.walletTransaction.findMany({
    where: {
      type: 'DEBIT',
      receiverId: user.id,
      description: { 
        contains: 'Charge',
        mode: 'insensitive'
      }
    }
  });

  console.log('Aggregate Result:', JSON.stringify(chargeStats, null, 2));
  console.log('Found Transactions:', allCharges.length);
  if (allCharges.length > 0) {
    console.log('First match createdAt:', allCharges[0].createdAt);
    console.log('First match amount:', allCharges[0].amount.toString());
    console.log('First match description:', allCharges[0].description);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
