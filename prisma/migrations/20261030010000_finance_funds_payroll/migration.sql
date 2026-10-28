-- AlterTable
ALTER TABLE "User" ADD COLUMN     "position" TEXT,
ADD COLUMN     "salary" INTEGER;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "leasingMonthly" INTEGER;

-- AlterTable
ALTER TABLE "PaymentRequest" ADD COLUMN     "fund" TEXT NOT NULL DEFAULT 'FREE';

-- CreateTable
CREATE TABLE "PayrollRow" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" TEXT,
    "calculation" TEXT NOT NULL,
    "accrued" INTEGER NOT NULL,
    "cash" INTEGER NOT NULL DEFAULT 0,
    "output" INTEGER,
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "patentCost" INTEGER NOT NULL DEFAULT 0,
    "patentFrom" TIMESTAMP(3),
    "patentTo" TIMESTAMP(3),
    "insuranceFixed" INTEGER NOT NULL DEFAULT 5739000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRow_month_userId_key" ON "PayrollRow"("month", "userId");

-- AddForeignKey
ALTER TABLE "PayrollRow" ADD CONSTRAINT "PayrollRow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

