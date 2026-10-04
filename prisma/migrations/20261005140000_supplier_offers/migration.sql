-- CreateTable
CREATE TABLE "SupplierOffer" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT,
    "price" INTEGER NOT NULL,
    "deliveryDays" INTEGER,
    "quality" TEXT,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierOffer_productId_idx" ON "SupplierOffer"("productId");

-- CreateIndex
CREATE INDEX "SupplierOffer_supplierId_idx" ON "SupplierOffer"("supplierId");

-- AddForeignKey
ALTER TABLE "SupplierOffer" ADD CONSTRAINT "SupplierOffer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOffer" ADD CONSTRAINT "SupplierOffer_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Today's supplier + purchase price of each product become its first offer.
INSERT INTO "SupplierOffer" ("id", "productId", "supplierId", "price", "selected", "createdAt", "updatedAt")
SELECT 'so_' || pp."productId", pp."productId", pp."supplierId", pp."purchasePrice", true, p."updatedAt", p."updatedAt"
FROM "ProductPricing" pp JOIN "Product" p ON p."id" = pp."productId"
WHERE pp."supplierId" IS NOT NULL OR pp."purchasePrice" > 0;
