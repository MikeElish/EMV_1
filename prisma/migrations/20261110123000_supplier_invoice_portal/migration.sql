ALTER TABLE "SupplierPurchase"
ADD COLUMN "invoiceTokenHash" TEXT;

CREATE UNIQUE INDEX "SupplierPurchase_invoiceTokenHash_key"
ON "SupplierPurchase"("invoiceTokenHash");
