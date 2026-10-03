-- CreateTable
CREATE TABLE "YandexFleetSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "parkId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "apiKeyEnc" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YandexFleetSettings_pkey" PRIMARY KEY ("id")
);
