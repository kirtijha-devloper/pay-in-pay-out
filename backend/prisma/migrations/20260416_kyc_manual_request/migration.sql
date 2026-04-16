CREATE TABLE IF NOT EXISTS "KycRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "dateOfBirth" TIMESTAMP(3),
  "gender" TEXT,
  "aadhaarNumber" TEXT NOT NULL,
  "panNumber" TEXT,
  "kycPhotoPath" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewRemark" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KycRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KycRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "KycRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "KycRequest_userId_status_createdAt_idx"
ON "KycRequest" ("userId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "KycRequest_status_createdAt_idx"
ON "KycRequest" ("status", "createdAt");
