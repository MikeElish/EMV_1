-- AlterTable
ALTER TABLE "ExtraCost" ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileUrl" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'Иные затраты',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Требуется оплата',
ADD COLUMN     "supplierId" TEXT,
ALTER COLUMN "number" SET DEFAULT '',
ALTER COLUMN "orderId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ExtraCostLine" (
    "id" TEXT NOT NULL,
    "extraCostId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "productId" TEXT,
    "serviceId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" INTEGER NOT NULL,
    "sum" INTEGER NOT NULL,

    CONSTRAINT "ExtraCostLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExtraCostLine_extraCostId_idx" ON "ExtraCostLine"("extraCostId");

-- CreateIndex
CREATE INDEX "ExtraCost_supplierId_idx" ON "ExtraCost"("supplierId");

-- AddForeignKey
ALTER TABLE "ExtraCost" ADD CONSTRAINT "ExtraCost_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraCostLine" ADD CONSTRAINT "ExtraCostLine_extraCostId_fkey" FOREIGN KEY ("extraCostId") REFERENCES "ExtraCost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraCostLine" ADD CONSTRAINT "ExtraCostLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraCostLine" ADD CONSTRAINT "ExtraCostLine_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

