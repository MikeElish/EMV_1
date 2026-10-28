-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactName" TEXT;

-- CreateTable
CREATE TABLE "PriceRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contactName" TEXT,
    "items" JSONB NOT NULL,
    "messageId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remindedAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "answerNote" TEXT,
    "summarySentAt" TIMESTAMP(3),

    CONSTRAINT "PriceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceRequest_orderId_idx" ON "PriceRequest"("orderId");

-- CreateIndex
CREATE INDEX "PriceRequest_supplierId_idx" ON "PriceRequest"("supplierId");

-- CreateIndex
CREATE INDEX "PriceRequest_answeredAt_idx" ON "PriceRequest"("answeredAt");

-- AddForeignKey
ALTER TABLE "PriceRequest" ADD CONSTRAINT "PriceRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRequest" ADD CONSTRAINT "PriceRequest_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

