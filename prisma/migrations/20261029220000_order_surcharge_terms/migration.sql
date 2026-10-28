-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "surcharge" INTEGER NOT NULL DEFAULT 0;

