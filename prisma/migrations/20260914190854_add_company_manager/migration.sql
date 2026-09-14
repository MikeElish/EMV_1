-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "managerId" TEXT;

-- CreateIndex
CREATE INDEX "Company_managerId_idx" ON "Company"("managerId");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
