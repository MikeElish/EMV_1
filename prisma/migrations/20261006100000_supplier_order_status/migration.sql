-- CreateEnum
CREATE TYPE "SupplierOrderStatus" AS ENUM ('TO_CHECK', 'REQUESTED', 'CHECKED', 'AWAITING_PAYMENT', 'ORDERED', 'DELIVERED');

-- AlterTable
ALTER TABLE "SupplierOrderLine" ADD COLUMN     "status" "SupplierOrderStatus" NOT NULL DEFAULT 'TO_CHECK';

-- Lines whose customer order line already moved on follow it.
UPDATE "SupplierOrderLine" s SET "status" = 'AWAITING_PAYMENT'
FROM "OrderItem" i WHERE s."orderItemId" = i."id" AND i."status" = 'AWAITING_SUPPLY';
UPDATE "SupplierOrderLine" s SET "status" = 'DELIVERED'
FROM "OrderItem" i WHERE s."orderItemId" = i."id" AND i."status" IN ('READY_TO_SHIP', 'SHIPPED_AWAITING_PAYMENT', 'DONE');
