-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "oneCNoMatch" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "kpp" TEXT,
ADD COLUMN     "oneCRef" TEXT;

-- CreateTable
CREATE TABLE "OneCProductLink" (
    "ref" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OneCProductLink_pkey" PRIMARY KEY ("ref")
);

-- CreateIndex
CREATE INDEX "OneCProductLink_productId_idx" ON "OneCProductLink"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_oneCRef_key" ON "Company"("oneCRef");

-- AddForeignKey
ALTER TABLE "OneCProductLink" ADD CONSTRAINT "OneCProductLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
