-- CreateTable
CREATE TABLE "OneCSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "baseUrl" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OneCSettings_pkey" PRIMARY KEY ("id")
);
