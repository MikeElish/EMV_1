-- AlterEnum
ALTER TYPE "SupplierOrderStatus" ADD VALUE 'TO_ORDER' BEFORE 'AWAITING_PAYMENT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "access" JSONB;
