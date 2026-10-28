-- DropIndex
DROP INDEX "Payment_orderId_key";

-- DropIndex
DROP INDEX "Payment_yookassaId_key";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "yookassaId",
ADD COLUMN     "amount" INTEGER NOT NULL,
ADD COLUMN     "lineIds" TEXT[],
ADD COLUMN     "operationId" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CashReceipt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT,
    "kind" TEXT NOT NULL,
    "lineIds" TEXT[],
    "amount" INTEGER NOT NULL,
    "atolUuid" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "error" TEXT,
    "fiscal" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashboxSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "atolLogin" TEXT NOT NULL DEFAULT '',
    "atolPasswordEnc" TEXT,
    "atolGroupCode" TEXT NOT NULL DEFAULT '',
    "sno" TEXT NOT NULL DEFAULT 'osn',
    "vat" TEXT NOT NULL DEFAULT 'vat22',
    "inn" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "paymentAddress" TEXT NOT NULL DEFAULT 'https://emv.one',
    "receiptsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sbpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "bankAccountId" TEXT,
    "customerCode" TEXT,
    "merchantId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashboxSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashReceipt_orderId_idx" ON "CashReceipt"("orderId");

-- CreateIndex
CREATE INDEX "CashReceipt_status_idx" ON "CashReceipt"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_operationId_key" ON "Payment"("operationId");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- AddForeignKey
ALTER TABLE "CashReceipt" ADD CONSTRAINT "CashReceipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashReceipt" ADD CONSTRAINT "CashReceipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

