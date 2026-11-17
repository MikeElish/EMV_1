-- Add tender markup to PriceSettings
ALTER TABLE "PriceSettings" ADD COLUMN "tenderMarkup" DOUBLE PRECISION NOT NULL DEFAULT 50;

-- Add TENDER value to the CompanyPriceType enum
ALTER TYPE "CompanyPriceType" ADD VALUE 'TENDER';

-- Create Brand lookup table
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");
