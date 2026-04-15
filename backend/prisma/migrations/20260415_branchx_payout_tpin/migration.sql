ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "transactionPinHash" TEXT,
ADD COLUMN IF NOT EXISTS "transactionPinUpdatedAt" TIMESTAMP(3);

ALTER TABLE "ServiceRequest"
ADD COLUMN IF NOT EXISTS "chargeDistribution" TEXT;
