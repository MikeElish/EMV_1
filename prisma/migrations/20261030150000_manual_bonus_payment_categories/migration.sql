CREATE TYPE "PaymentPurposeCategory" AS ENUM (
    'GOODS',
    'SERVICES',
    'DELIVERY',
    'RENT',
    'BONUSES',
    'OTHER',
    'SALARY'
);

ALTER TABLE "OrderItem"
ADD COLUMN "bonus" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "SiteSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "manualInputEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BonusSettlement" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "bonusOverride" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BonusSettlement_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PaymentRequest"
ADD COLUMN "purposeCategory" "PaymentPurposeCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN "managerId" TEXT,
ADD COLUMN "bonusCompanyId" TEXT,
ADD COLUMN "bonusPeriodFrom" TIMESTAMP(3),
ADD COLUMN "bonusPeriodTo" TIMESTAMP(3),
ADD COLUMN "bonusSettlementId" TEXT;

CREATE UNIQUE INDEX "BonusSettlement_managerId_companyId_periodFrom_periodTo_key"
ON "BonusSettlement"("managerId", "companyId", "periodFrom", "periodTo");

CREATE INDEX "BonusSettlement_companyId_periodFrom_periodTo_idx"
ON "BonusSettlement"("companyId", "periodFrom", "periodTo");

CREATE UNIQUE INDEX "PaymentRequest_bonusSettlementId_key"
ON "PaymentRequest"("bonusSettlementId");

CREATE UNIQUE INDEX "PaymentRequest_managerId_bonusCompanyId_bonusPeriodFrom_bon_key"
ON "PaymentRequest"("managerId", "bonusCompanyId", "bonusPeriodFrom", "bonusPeriodTo");

ALTER TABLE "BonusSettlement"
ADD CONSTRAINT "BonusSettlement_managerId_fkey"
FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "BonusSettlement_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentRequest"
ADD CONSTRAINT "PaymentRequest_managerId_fkey"
FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "PaymentRequest_bonusCompanyId_fkey"
FOREIGN KEY ("bonusCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "PaymentRequest_bonusSettlementId_fkey"
FOREIGN KEY ("bonusSettlementId") REFERENCES "BonusSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
