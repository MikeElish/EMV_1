-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('AI95', 'AI92', 'LPG');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "personalDataConsentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FuelReceipt" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "driverName" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "fuelType" "FuelType" NOT NULL,
    "liters" DOUBLE PRECISION NOT NULL,
    "pricePerLiter" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "vatRate" INTEGER,
    "stationInn" TEXT NOT NULL,
    "stationName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuelReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FuelReceipt_date_idx" ON "FuelReceipt"("date");

-- CreateIndex
CREATE INDEX "FuelReceipt_vehicleId_idx" ON "FuelReceipt"("vehicleId");

-- AddForeignKey
ALTER TABLE "FuelReceipt" ADD CONSTRAINT "FuelReceipt_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

