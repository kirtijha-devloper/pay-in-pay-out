"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureRuntimeSchema = ensureRuntimeSchema;
const prisma_1 = __importDefault(require("../lib/prisma"));
let runtimeSchemaReady = null;
async function ensureRuntimeSchema() {
    if (!runtimeSchemaReady) {
        runtimeSchemaReady = (async () => {
            await prisma_1.default.$executeRawUnsafe(`
        ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS "transactionPinHash" TEXT
      `);
            await prisma_1.default.$executeRawUnsafe(`
        ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS "transactionPinUpdatedAt" TIMESTAMP(3)
      `);
            await prisma_1.default.$executeRawUnsafe(`
        ALTER TABLE "ServiceRequest"
        ADD COLUMN IF NOT EXISTS "chargeDistribution" TEXT
      `);
            await prisma_1.default.$executeRawUnsafe(`
        ALTER TABLE "ServiceRequest"
        ADD COLUMN IF NOT EXISTS "providerStatus" TEXT
      `);
            await prisma_1.default.$executeRawUnsafe(`
        ALTER TABLE "ServiceRequest"
        ADD COLUMN IF NOT EXISTS "providerStatusCode" TEXT
      `);
            await prisma_1.default.$executeRawUnsafe(`
        ALTER TABLE "ServiceRequest"
        ADD COLUMN IF NOT EXISTS "providerResponse" TEXT
      `);
            await prisma_1.default.$executeRawUnsafe(`
        ALTER TABLE "ServiceRequest"
        ADD COLUMN IF NOT EXISTS "callbackStatus" TEXT
      `);
            await prisma_1.default.$executeRawUnsafe(`
        ALTER TABLE "ServiceRequest"
        ADD COLUMN IF NOT EXISTS "callbackData" TEXT
      `);
            await prisma_1.default.$executeRawUnsafe(`
        ALTER TABLE "ServiceRequest"
        ADD COLUMN IF NOT EXISTS "callbackReceivedAt" TIMESTAMP(3)
      `);
            await prisma_1.default.$executeRawUnsafe(`
        ALTER TABLE "ServiceRequest"
        ADD COLUMN IF NOT EXISTS "callbackRequestId" TEXT
      `);
            await prisma_1.default.$executeRawUnsafe(`
        ALTER TABLE "ServiceRequest"
        ADD COLUMN IF NOT EXISTS "callbackOpRefId" TEXT
      `);
            await prisma_1.default.$executeRawUnsafe(`
        ALTER TABLE "ServiceRequest"
        ADD COLUMN IF NOT EXISTS "callbackApiTxnId" TEXT
      `);
            await prisma_1.default.$executeRawUnsafe(`
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
            await prisma_1.default.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "BranchxCallbackAudit_sourceIp_createdAt_idx"
        ON "BranchxCallbackAudit" ("sourceIp", "createdAt")
      `);
            await prisma_1.default.$executeRawUnsafe(`
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
