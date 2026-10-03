-- New order statuses
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CHECKING';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'READY_TO_SHIP';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'AWAITING_SUPPLY';

-- "Отсрочка" on the order
ALTER TABLE "Order" ADD COLUMN "deferred" BOOLEAN NOT NULL DEFAULT false;

-- Per-line status
ALTER TABLE "OrderItem" ADD COLUMN "status" "OrderStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
ADD COLUMN "statusNotifyPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stockWrittenOff" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "OrderItem_productId_status_idx" ON "OrderItem"("productId", "status");
CREATE INDEX "OrderItem_statusNotifyPending_idx" ON "OrderItem"("statusNotifyPending");

-- Existing lines take their order's status; cancelled lines are CANCELLED.
-- Lines already shipped are treated as already taken off stock (stock was
-- kept by hand until now).
UPDATE "OrderItem" i SET
  "status" = CASE WHEN i."cancelled" THEN 'CANCELLED'::"OrderStatus" ELSE o."status" END,
  "stockWrittenOff" = (NOT i."cancelled" AND o."status" IN ('SHIPPED_AWAITING_PAYMENT', 'DONE'))
FROM "Order" o WHERE o."id" = i."orderId";

-- Orders of companies on deferred payment, not yet paid
UPDATE "Order" o SET "deferred" = true
FROM "User" u JOIN "Company" c ON c."id" = u."companyId"
WHERE o."userId" = u."id" AND c."paymentType" = 'DEFERRED' AND o."paid" = false;
