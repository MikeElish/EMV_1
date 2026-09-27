-- CreateTable
CREATE TABLE "ProductPricing" (
    "productId" TEXT NOT NULL,
    "purchasePrice" INTEGER NOT NULL,
    "retailPrice" INTEGER NOT NULL,
    "dealerPrice" INTEGER NOT NULL,
    "supplierId" TEXT,

    CONSTRAINT "ProductPricing_pkey" PRIMARY KEY ("productId")
);

-- CreateTable
CREATE TABLE "PriceSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "retailMarkup" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "wholesaleMarkup" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "dealerMarkup" DOUBLE PRECISION NOT NULL DEFAULT 15,

    CONSTRAINT "PriceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductPricing_supplierId_idx" ON "ProductPricing"("supplierId");

-- AddForeignKey
ALTER TABLE "ProductPricing" ADD CONSTRAINT "ProductPricing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPricing" ADD CONSTRAINT "ProductPricing_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the default markups
INSERT INTO "PriceSettings" ("id") VALUES (1);

-- Backfill: every existing product's current price is its wholesale price
-- (20% over purchase). Derive the purchase price from it, then retail (30%)
-- and dealer (15%) from the purchase price. Product.price stays untouched.
INSERT INTO "ProductPricing" ("productId", "purchasePrice", "retailPrice", "dealerPrice")
SELECT p."id", c."purchase", CEIL(c."purchase" * 1.30)::int, CEIL(c."purchase" * 1.15)::int
FROM "Product" p
CROSS JOIN LATERAL (SELECT ROUND(p."price" / 1.20)::int AS "purchase") c;
