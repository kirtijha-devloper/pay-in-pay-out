ALTER TABLE "CommissionSlab"
ADD COLUMN "setById" TEXT,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "CommissionSlab"
SET "minAmount" = 0
WHERE "minAmount" IS NULL;

UPDATE "CommissionSlab" AS slab
SET "setById" = admin."id"
FROM (
  SELECT "id"
  FROM "User"
  WHERE "role" = 'ADMIN'
  ORDER BY "createdAt" ASC
  LIMIT 1
) AS admin
WHERE slab."setById" IS NULL;

ALTER TABLE "CommissionSlab"
ALTER COLUMN "minAmount" SET DEFAULT 0.00,
ALTER COLUMN "minAmount" SET NOT NULL;

ALTER TABLE "CommissionSlab"
ALTER COLUMN "setById" SET NOT NULL;

ALTER TABLE "CommissionSlab"
ADD CONSTRAINT "CommissionSlab_setById_fkey"
FOREIGN KEY ("setById") REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

CREATE INDEX "CommissionSlab_setById_serviceType_applyOnRole_isActive_idx"
ON "CommissionSlab"("setById", "serviceType", "applyOnRole", "isActive");

UPDATE "UserCommissionSetup"
SET "minAmount" = 0
WHERE "minAmount" IS NULL;

ALTER TABLE "UserCommissionSetup"
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "UserCommissionSetup"
ALTER COLUMN "minAmount" SET DEFAULT 0.00,
ALTER COLUMN "minAmount" SET NOT NULL;

ALTER TABLE "UserCommissionSetup"
DROP CONSTRAINT IF EXISTS "UserCommissionSetup_setById_targetUserId_serviceType_key";

CREATE INDEX "UserCommissionSetup_setById_targetUserId_serviceType_isActive_idx"
ON "UserCommissionSetup"("setById", "targetUserId", "serviceType", "isActive");
