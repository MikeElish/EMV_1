DO $$
BEGIN
    CREATE TYPE "PriceRequestLineStatus" AS ENUM ('PENDING', 'OFFER', 'NO_OFFER');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PriceRequestLine" (
    "requestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "PriceRequestLineStatus" NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "PriceRequestLine_pkey" PRIMARY KEY ("requestId", "productId")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'PriceRequestLine_requestId_fkey'
          AND conrelid = '"PriceRequestLine"'::regclass
    ) THEN
        ALTER TABLE "PriceRequestLine" ADD CONSTRAINT "PriceRequestLine_requestId_fkey"
            FOREIGN KEY ("requestId") REFERENCES "PriceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'PriceRequestLine_productId_fkey'
          AND conrelid = '"PriceRequestLine"'::regclass
    ) THEN
        ALTER TABLE "PriceRequestLine" ADD CONSTRAINT "PriceRequestLine_productId_fkey"
            FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "PriceRequestLine_productId_idx" ON "PriceRequestLine"("productId");
CREATE UNIQUE INDEX IF NOT EXISTS "PriceRequest_orderId_supplierId_key"
    ON "PriceRequest"("orderId", "supplierId");

WITH discovered AS (
    SELECT
        offer."supplierId" AS "companyId",
        string_agg(DISTINCT btrim(product."brand"), ', ' ORDER BY btrim(product."brand"))
            FILTER (WHERE nullif(btrim(product."brand"), '') IS NOT NULL) AS brands,
        string_agg(DISTINCT btrim(category."name"), ', ' ORDER BY btrim(category."name"))
            FILTER (WHERE nullif(btrim(category."name"), '') IS NOT NULL) AS categories
    FROM "SupplierOffer" AS offer
    JOIN "Product" AS product ON product.id = offer."productId"
    JOIN "Company" AS company ON company.id = offer."supplierId" AND company."isOwn" = false
    LEFT JOIN "Category" AS category ON category.id = product."categoryId"
    WHERE offer."supplierId" IS NOT NULL
    GROUP BY offer."supplierId"
)
INSERT INTO "SupplierProfile" ("companyId", brands, categories, "updatedAt")
SELECT "companyId", coalesce(brands, ''), coalesce(categories, ''), CURRENT_TIMESTAMP
FROM discovered
ON CONFLICT ("companyId") DO UPDATE SET
    brands = CASE
        WHEN "SupplierProfile".brands = '' THEN EXCLUDED.brands
        ELSE "SupplierProfile".brands
    END,
    categories = CASE
        WHEN "SupplierProfile".categories = '' THEN EXCLUDED.categories
        ELSE "SupplierProfile".categories
    END,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PriceRequestLine" ("requestId", "productId")
SELECT DISTINCT request.id, product.id
FROM "PriceRequest" AS request
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(request."items"::jsonb) = 'array' THEN request."items"::jsonb
        ELSE '[]'::jsonb
    END
) AS item
JOIN "Product" AS product ON product.id = item->>'productId'
WHERE nullif(item->>'productId', '') IS NOT NULL
ON CONFLICT ("requestId", "productId") DO NOTHING;
