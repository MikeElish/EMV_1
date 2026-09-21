-- CreateEnum
CREATE TYPE "CompanyPaymentType" AS ENUM ('PREPAYMENT', 'DEFERRED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "shippedAt" TIMESTAMP(3),
ADD COLUMN "plannedPaymentDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "hasContract" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "paymentType" "CompanyPaymentType" NOT NULL DEFAULT 'PREPAYMENT',
ADD COLUMN "paymentDeferralDays" INTEGER;

-- CreateTable
CREATE TABLE "CompanyDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyDocument_companyId_idx" ON "CompanyDocument"("companyId");

-- AddForeignKey
ALTER TABLE "CompanyDocument" ADD CONSTRAINT "CompanyDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
