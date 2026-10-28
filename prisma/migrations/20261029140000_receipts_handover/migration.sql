-- AlterTable
ALTER TABLE "SupplierOrderLine" ADD COLUMN     "receiptId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "handover" TEXT,
ADD COLUMN     "handoverAt" TIMESTAMP(3),
ADD COLUMN     "handoverNote" TEXT;

-- CreateTable
CREATE TABLE "SupplierReceipt" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "supplierId" TEXT NOT NULL,
    "warehouseRef" TEXT NOT NULL,
    "docNumber" TEXT NOT NULL,
    "docDate" TIMESTAMP(3) NOT NULL,
    "vatRate" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "oneCRef" TEXT,
    "oneCNumber" TEXT,
    "fileName" TEXT,
    "fileUrl" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierReceipt_number_key" ON "SupplierReceipt"("number");

-- CreateIndex
CREATE INDEX "SupplierReceipt_supplierId_idx" ON "SupplierReceipt"("supplierId");

-- AddForeignKey
ALTER TABLE "SupplierOrderLine" ADD CONSTRAINT "SupplierOrderLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "SupplierReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReceipt" ADD CONSTRAINT "SupplierReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

