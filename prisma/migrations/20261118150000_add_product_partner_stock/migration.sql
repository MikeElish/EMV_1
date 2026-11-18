-- Add partner network stock summary to Product for fast shop availability checks.
ALTER TABLE "Product" ADD COLUMN "partnerStock" INTEGER NOT NULL DEFAULT 0;

-- Backfill from existing PartnerStock rows tied to a product.
UPDATE "Product" p
SET "partnerStock" = COALESCE((
  SELECT SUM(ps.quantity)
  FROM "PartnerStock" ps
  WHERE ps."productId" = p.id AND ps.quantity > 0
), 0);
