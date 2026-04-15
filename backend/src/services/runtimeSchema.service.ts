import prisma from '../lib/prisma';

let runtimeSchemaReady: Promise<void> | null = null;

export async function ensureRuntimeSchema() {
  if (!runtimeSchemaReady) {
    runtimeSchemaReady = (async () => {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS "transactionPinHash" TEXT
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS "transactionPinUpdatedAt" TIMESTAMP(3)
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ServiceRequest"
        ADD COLUMN IF NOT EXISTS "chargeDistribution" TEXT
      `);
    })().catch((error) => {
      runtimeSchemaReady = null;
      throw error;
    });
  }

  return runtimeSchemaReady;
}
