-- AlterTable
ALTER TABLE "User" ADD COLUMN "mailLogin" TEXT,
ADD COLUMN "mailPasswordEnc" TEXT;

-- CreateTable
CREATE TABLE "MailSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "smtpHost" TEXT NOT NULL,
    "smtpPort" INTEGER NOT NULL,
    "imapHost" TEXT NOT NULL,
    "imapPort" INTEGER NOT NULL,
    "login" TEXT NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "senderName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailSettings_pkey" PRIMARY KEY ("id")
);
