-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "emailCodeHash" TEXT,
ADD COLUMN     "emailCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "emailCodeSentAt" TIMESTAMP(3),
ADD COLUMN     "emailCodeAttempts" INTEGER NOT NULL DEFAULT 0;

-- Accounts that existed before e-mail confirmation was introduced are not
-- asked to confirm retroactively.
UPDATE "User" SET "emailVerifiedAt" = CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "GlonassSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "serverUrl" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlonassSettings_pkey" PRIMARY KEY ("id")
);
