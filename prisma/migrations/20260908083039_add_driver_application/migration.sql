-- CreateEnum
CREATE TYPE "DriverApplicationStatus" AS ENUM ('NEW', 'CONTACTED');

-- CreateTable
CREATE TABLE "DriverApplication" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "drivingExperienceYears" INTEGER,
    "previousDriverExperience" BOOLEAN NOT NULL,
    "status" "DriverApplicationStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriverApplication_status_idx" ON "DriverApplication"("status");
