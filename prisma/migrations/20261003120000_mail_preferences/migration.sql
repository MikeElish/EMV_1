-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mailSenderName" TEXT,
ADD COLUMN     "mailSignature" TEXT,
ADD COLUMN     "mailPageSize" INTEGER NOT NULL DEFAULT 30;
