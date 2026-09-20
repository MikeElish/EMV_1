-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('ADDRESS', 'TERMINAL', 'PICKUP');

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "cancelled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "defaultDeliveryMethod" "DeliveryMethod",
ADD COLUMN "defaultSettlement" TEXT,
ADD COLUMN "defaultStreet" TEXT,
ADD COLUMN "defaultHouse" TEXT,
ADD COLUMN "defaultApartment" TEXT,
ADD COLUMN "defaultTerminal" TEXT;
