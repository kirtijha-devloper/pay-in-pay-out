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
        })().catch((error) => {
            runtimeSchemaReady = null;
            throw error;
        });
    }
    return runtimeSchemaReady;
}
