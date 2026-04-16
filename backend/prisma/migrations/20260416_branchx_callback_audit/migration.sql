ALTER TABLE "ServiceRequest"
ADD COLUMN IF NOT EXISTS "providerStatus" TEXT;

ALTER TABLE "ServiceRequest"
ADD COLUMN IF NOT EXISTS "providerStatusCode" TEXT;

ALTER TABLE "ServiceRequest"
ADD COLUMN IF NOT EXISTS "providerResponse" TEXT;

ALTER TABLE "ServiceRequest"
ADD COLUMN IF NOT EXISTS "callbackStatus" TEXT;

ALTER TABLE "ServiceRequest"
ADD COLUMN IF NOT EXISTS "callbackData" TEXT;

ALTER TABLE "ServiceRequest"
ADD COLUMN IF NOT EXISTS "callbackReceivedAt" TIMESTAMP(3);

ALTER TABLE "ServiceRequest"
ADD COLUMN IF NOT EXISTS "callbackRequestId" TEXT;

ALTER TABLE "ServiceRequest"
ADD COLUMN IF NOT EXISTS "callbackOpRefId" TEXT;

ALTER TABLE "ServiceRequest"
ADD COLUMN IF NOT EXISTS "callbackApiTxnId" TEXT;

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
);

CREATE INDEX IF NOT EXISTS "BranchxCallbackAudit_sourceIp_createdAt_idx"
ON "BranchxCallbackAudit" ("sourceIp", "createdAt");

CREATE INDEX IF NOT EXISTS "BranchxCallbackAudit_serviceRequestId_createdAt_idx"
ON "BranchxCallbackAudit" ("serviceRequestId", "createdAt");
