-- CreateEnum
CREATE TYPE "RepairType" AS ENUM ('SCHEDULED_SERVICE', 'BODY', 'UNIT', 'OPERATIONAL', 'TIRES');

-- CreateEnum
CREATE TYPE "RepairShop" AS ENUM ('MECHANIC', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "RepairStatus" AS ENUM ('PLANNED', 'IN_REPAIR', 'AWAITING_PARTS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RepairLineKind" AS ENUM ('SERVICE', 'PRODUCT');

-- CreateTable
CREATE TABLE "Repair" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" "RepairType" NOT NULL,
    "shop" "RepairShop" NOT NULL,
    "status" "RepairStatus" NOT NULL DEFAULT 'PLANNED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairLine" (
    "id" TEXT NOT NULL,
    "repairId" TEXT NOT NULL,
    "kind" "RepairLineKind" NOT NULL,
    "productId" TEXT,
    "serviceId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairDocument" (
    "id" TEXT NOT NULL,
    "repairId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Repair_vehicleId_idx" ON "Repair"("vehicleId");

-- CreateIndex
CREATE INDEX "Repair_date_idx" ON "Repair"("date");

-- CreateIndex
CREATE INDEX "RepairLine_repairId_idx" ON "RepairLine"("repairId");

-- CreateIndex
CREATE INDEX "RepairDocument_repairId_idx" ON "RepairDocument"("repairId");

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairLine" ADD CONSTRAINT "RepairLine_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "Repair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairLine" ADD CONSTRAINT "RepairLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairLine" ADD CONSTRAINT "RepairLine_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairDocument" ADD CONSTRAINT "RepairDocument_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "Repair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

