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

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ServiceRequest"
        ADD COLUMN IF NOT EXISTS "providerStatus" TEXT
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ServiceRequest"
        ADD COLUMN IF NOT EXISTS "providerStatusCode" TEXT
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ServiceRequest"
        ADD COLUMN IF NOT EXISTS "providerResponse" TEXT
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ServiceRequest"
        ADD COLUMN IF NOT EXISTS "callbackStatus" TEXT
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ServiceRequest"
        ADD COLUMN IF NOT EXISTS "callbackData" TEXT
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ServiceRequest"
        ADD COLUMN IF NOT EXISTS "callbackReceivedAt" TIMESTAMP(3)
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ServiceRequest"
        ADD COLUMN IF NOT EXISTS "callbackRequestId" TEXT
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ServiceRequest"
        ADD COLUMN IF NOT EXISTS "callbackOpRefId" TEXT
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ServiceRequest"
        ADD COLUMN IF NOT EXISTS "callbackApiTxnId" TEXT
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "BranchxCallbackAudit" (
          "id" TEXT NOT NULL,
          "serviceRequestId" TEXT,
          "requestIdentifier" TEXT,
          "sourceIp" TEXT NOT NULL,
          "forwardedFor" TEXT,
          "method" TEXT NOT NULL,
          "rawStatus" TEXT,
          "normalizedStatus" TEXT,
          "payload" TEXT,
          "userAgent" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "BranchxCallbackAudit_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "BranchxCallbackAudit_serviceRequestId_fkey"
            FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE
        )
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "BranchxCallbackAudit_sourceIp_createdAt_idx"
        ON "BranchxCallbackAudit" ("sourceIp", "createdAt")
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "BranchxCallbackAudit_serviceRequestId_createdAt_idx"
        ON "BranchxCallbackAudit" ("serviceRequestId", "createdAt")
      `);
    })().catch((error) => {
      runtimeSchemaReady = null;
      throw error;
    });
  }

  return runtimeSchemaReady;
}
