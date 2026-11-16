-- Add isOnlineStore flag to Company
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "isOnlineStore" BOOLEAN NOT NULL DEFAULT false;
