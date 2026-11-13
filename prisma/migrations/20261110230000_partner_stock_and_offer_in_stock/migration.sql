-- Add stock flags to supplier offers
ALTER TABLE "SupplierOffer"
  ADD COLUMN "inStock" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stockQuantity" INTEGER;

-- Partner supplier stock table
CREATE TABLE "PartnerStock" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "productId" TEXT,
  "offerId" TEXT,
  "brand" TEXT,
  "name" TEXT,
  "sku" TEXT,
  "quantity" INTEGER,
  "price" INTEGER,
  "total" INTEGER,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PartnerStock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerStock_supplierId_sku_key" ON "PartnerStock"("supplierId", "sku");
CREATE INDEX "PartnerStock_supplierId_idx" ON "PartnerStock"("supplierId");
CREATE INDEX "PartnerStock_productId_idx" ON "PartnerStock"("productId");
CREATE INDEX "PartnerStock_offerId_idx" ON "PartnerStock"("offerId");

-- Add foreign keys
ALTER TABLE "PartnerStock" ADD CONSTRAINT "PartnerStock_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerStock" ADD CONSTRAINT "PartnerStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartnerStock" ADD CONSTRAINT "PartnerStock_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "SupplierOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
