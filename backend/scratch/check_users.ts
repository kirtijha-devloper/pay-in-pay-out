import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('Checking users in database...');
  const users = await prisma.user.findMany({
    select: {
      email: true,
      role: true,
      isActive: true
    }
  });
  console.log('Current users:', JSON.stringify(users, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
