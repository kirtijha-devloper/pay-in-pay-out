CREATE TABLE "BankVerificationFee" (
  "id" TEXT NOT NULL,
  "amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BankVerificationFee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payout_beneficiaries" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "payee_name" TEXT NOT NULL,
  "account_no" TEXT NOT NULL,
  "bank_ifsc" TEXT NOT NULL,
  "bank_name" TEXT NOT NULL,
  "is_verified" BOOLEAN NOT NULL DEFAULT false,
  "verified_at" TIMESTAMP(3),
  "provider_ref" TEXT,
  "provider_status_code" TEXT,
  "provider_response" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payout_beneficiaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payout_beneficiaries_userId_account_no_bank_ifsc_key"
ON "payout_beneficiaries"("userId", "account_no", "bank_ifsc");

CREATE INDEX "payout_beneficiaries_userId_idx"
ON "payout_beneficiaries"("userId");

ALTER TABLE "payout_beneficiaries"
ADD CONSTRAINT "payout_beneficiaries_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
