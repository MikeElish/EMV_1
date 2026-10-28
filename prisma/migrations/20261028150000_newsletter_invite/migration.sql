-- CreateTable
CREATE TABLE "NewsletterInvite" (
    "email" TEXT NOT NULL,
    "name" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterInvite_pkey" PRIMARY KEY ("email")
);
