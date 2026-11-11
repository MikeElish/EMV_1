ALTER TABLE "SupplierOffer"
    ADD COLUMN IF NOT EXISTS "warehouse" TEXT;

ALTER TABLE "SupplierOrderLine"
    ADD COLUMN IF NOT EXISTS "quotedPrice" INTEGER,
    ADD COLUMN IF NOT EXISTS "warehouse" TEXT;

UPDATE "SupplierOrderLine"
SET "quotedPrice" = "price"
WHERE "quotedPrice" IS NULL;

ALTER TABLE "PriceRequest"
    ADD COLUMN IF NOT EXISTS "tokenHash" TEXT,
    ADD COLUMN IF NOT EXISTS "managerNotifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "PriceRequest_tokenHash_key"
    ON "PriceRequest"("tokenHash");

ALTER TABLE "SupplierProfile"
    ADD COLUMN IF NOT EXISTS "logisticsMarkupPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "SupplierProfile"
SET "brands" = '',
    "categories" = '',
    "updatedAt" = CURRENT_TIMESTAMP;
