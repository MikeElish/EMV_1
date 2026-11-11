ALTER TABLE "SupplierOffer"
  ADD COLUMN "quotedPrice" INTEGER,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'RUB',
  ADD COLUMN "exchangeRate" DOUBLE PRECISION DEFAULT 1,
  ADD COLUMN "logisticsMarkupPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "SupplierOffer"
SET "quotedPrice" = "price"
WHERE "quotedPrice" IS NULL;

ALTER TABLE "SupplierOrderLine"
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'RUB',
  ADD COLUMN "exchangeRate" DOUBLE PRECISION DEFAULT 1,
  ADD COLUMN "logisticsMarkupPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "SupplierOrderLine"
SET "quotedPrice" = COALESCE("quotedPrice", "price");

ALTER TABLE "PaymentRequest"
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'RUB',
  ADD COLUMN "currencyAmount" INTEGER,
  ADD COLUMN "exchangeRate" DOUBLE PRECISION DEFAULT 1;
