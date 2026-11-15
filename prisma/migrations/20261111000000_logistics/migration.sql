-- CreateEnum
CREATE TYPE "LogisticsRequestType" AS ENUM ('SEND', 'RECEIVE');
CREATE TYPE "LogisticsRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "LogisticsSetting" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Россия',
    "city" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogisticsSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogisticsRequest" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "type" "LogisticsRequestType" NOT NULL,
    "status" "LogisticsRequestStatus" NOT NULL DEFAULT 'PENDING',
    "counterpartyId" TEXT,
    "address" TEXT,
    "fileName" TEXT,
    "fileUrl" TEXT,
    "documentKind" TEXT,
    "cost" INTEGER,
    "executorId" TEXT,
    "orderId" TEXT,
    "supplierPurchaseId" TEXT,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogisticsRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LogisticsSetting_country_city_key" ON "LogisticsSetting"("country", "city");

-- CreateIndex
CREATE UNIQUE INDEX "LogisticsRequest_number_key" ON "LogisticsRequest"("number");

-- CreateIndex
CREATE INDEX "LogisticsRequest_counterpartyId_idx" ON "LogisticsRequest"("counterpartyId");

-- CreateIndex
CREATE INDEX "LogisticsRequest_executorId_idx" ON "LogisticsRequest"("executorId");

-- CreateIndex
CREATE INDEX "LogisticsRequest_orderId_idx" ON "LogisticsRequest"("orderId");

-- CreateIndex
CREATE INDEX "LogisticsRequest_supplierPurchaseId_idx" ON "LogisticsRequest"("supplierPurchaseId");

-- AddForeignKey
ALTER TABLE "LogisticsRequest" ADD CONSTRAINT "LogisticsRequest_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticsRequest" ADD CONSTRAINT "LogisticsRequest_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticsRequest" ADD CONSTRAINT "LogisticsRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticsRequest" ADD CONSTRAINT "LogisticsRequest_supplierPurchaseId_fkey" FOREIGN KEY ("supplierPurchaseId") REFERENCES "SupplierPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
