CREATE TABLE "CompanyBankAccount" (
  "id" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "ifscCode" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  "updatedById" TEXT,

  CONSTRAINT "CompanyBankAccount_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ServiceRequest"
ADD COLUMN "chargeAmount" DECIMAL(15,2),
ADD COLUMN "creditedAmount" DECIMAL(15,2),
ADD COLUMN "receiptPath" TEXT,
ADD COLUMN "companyBankAccountId" TEXT,
ADD COLUMN "approvedById" TEXT,
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "rejectedById" TEXT,
ADD COLUMN "rejectedAt" TIMESTAMP(3);

ALTER TABLE "WalletTransaction"
ADD COLUMN "serviceRequestId" TEXT;

CREATE UNIQUE INDEX "CompanyBankAccount_accountNumber_key"
ON "CompanyBankAccount"("accountNumber");

CREATE INDEX "CompanyBankAccount_createdById_idx"
ON "CompanyBankAccount"("createdById");

CREATE INDEX "CompanyBankAccount_updatedById_idx"
ON "CompanyBankAccount"("updatedById");

CREATE INDEX "ServiceRequest_companyBankAccountId_idx"
ON "ServiceRequest"("companyBankAccountId");

CREATE INDEX "ServiceRequest_approvedById_idx"
ON "ServiceRequest"("approvedById");

CREATE INDEX "ServiceRequest_rejectedById_idx"
ON "ServiceRequest"("rejectedById");

CREATE INDEX "WalletTransaction_serviceRequestId_idx"
ON "WalletTransaction"("serviceRequestId");

ALTER TABLE "CompanyBankAccount"
ADD CONSTRAINT "CompanyBankAccount_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompanyBankAccount"
ADD CONSTRAINT "CompanyBankAccount_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServiceRequest"
ADD CONSTRAINT "ServiceRequest_companyBankAccountId_fkey"
FOREIGN KEY ("companyBankAccountId") REFERENCES "CompanyBankAccount"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServiceRequest"
ADD CONSTRAINT "ServiceRequest_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServiceRequest"
ADD CONSTRAINT "ServiceRequest_rejectedById_fkey"
FOREIGN KEY ("rejectedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WalletTransaction"
ADD CONSTRAINT "WalletTransaction_serviceRequestId_fkey"
FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
