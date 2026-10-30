ALTER TABLE "Order" ADD COLUMN "buyerCompanyId" TEXT;

UPDATE "Order" AS o
SET "buyerCompanyId" = u."companyId"
FROM "User" AS u
WHERE o."userId" = u."id"
  AND u."companyId" IS NOT NULL;

CREATE INDEX "Order_buyerCompanyId_idx" ON "Order"("buyerCompanyId");

ALTER TABLE "Order"
ADD CONSTRAINT "Order_buyerCompanyId_fkey"
FOREIGN KEY ("buyerCompanyId") REFERENCES "Company"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
