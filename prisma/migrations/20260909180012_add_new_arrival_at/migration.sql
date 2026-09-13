-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "newArrivalAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Product_newArrivalAt_idx" ON "Product"("newArrivalAt");
