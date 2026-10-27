-- CreateEnum
CREATE TYPE "CompanyPriceType" AS ENUM ('RETAIL', 'WHOLESALE', 'DEALER', 'INDIVIDUAL');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "priceType" "CompanyPriceType" NOT NULL DEFAULT 'WHOLESALE',
ADD COLUMN "individualMarkup" DOUBLE PRECISION;
