const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Transaction Description Migration ---');

  // 1. Update Fund Request Commission Debits
  const transactionsToUpdate = await prisma.walletTransaction.findMany({
    where: {
      description: 'Fund request commission',
      type: 'DEBIT',
    },
    include: {
      serviceRequest: {
        include: {
          approvedBy: true,
        },
      },
    },
  });

  console.log(`Found ${transactionsToUpdate.length} old fund request commission transactions.`);

  for (const tx of transactionsToUpdate) {
    const approverEmail = tx.serviceRequest?.approvedBy?.email || 'Admin';
    const newDescription = `Fund Request Charges | Approved by ${approverEmail} | Charges Deducted`;

    await prisma.walletTransaction.update({
      where: { id: tx.id },
      data: { description: newDescription },
    });
    console.log(`Updated TX ${tx.id} to: ${newDescription}`);
  }

  // 2. Update Fund Request Approval Credits
  const creditsToUpdate = await prisma.walletTransaction.findMany({
    where: {
      description: 'Wallet top-up approved',
      type: 'CREDIT',
    },
    include: {
      serviceRequest: {
        include: {
          approvedBy: true,
        },
      },
    },
  });

  console.log(`Found ${creditsToUpdate.length} old wallet top-up transactions.`);

  for (const tx of creditsToUpdate) {
    const approverEmail = tx.serviceRequest?.approvedBy?.email || 'Admin';
    const newDescription = `Wallet Top-up | Fund Request approved by ${approverEmail}`;

    await prisma.walletTransaction.update({
      where: { id: tx.id },
      data: { description: newDescription },
    });
    console.log(`Updated TX ${tx.id} to: ${newDescription}`);
  }

  // 3. Update Bank Verification Descriptions
  const updatedBankFees = await prisma.walletTransaction.updateMany({
    where: { description: 'Bank verification fee' },
    data: { description: 'Bank Verification | Charges Deducted' }
  });
  console.log(`Updated ${updatedBankFees.count} bank verification descriptions.`);

  // 4. Update Commission descriptions for ancestors
  const updatedCommissions = await prisma.walletTransaction.updateMany({
    where: { description: 'Fund request commission', type: 'CREDIT' },
    data: { description: 'Commission Earned | Fund Request' }
  });
  console.log(`Updated ${updatedCommissions.count} fund request commission credit descriptions.`);

  const updatedPayoutCommissions = await prisma.walletTransaction.updateMany({
    where: { description: 'Payout commission', type: 'CREDIT' },
    data: { description: 'Commission Earned | Payout' }
  });
  console.log(`Updated ${updatedPayoutCommissions.count} payout commission credit descriptions.`);

  console.log('--- Migration Completed ---');
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
