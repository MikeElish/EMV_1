-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "managerId" TEXT;

-- AlterTable
ALTER TABLE "ExtraCost" ADD COLUMN     "employeeId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "salaryPercent" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "ExtraCost_employeeId_idx" ON "ExtraCost"("employeeId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraCost" ADD CONSTRAINT "ExtraCost_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

