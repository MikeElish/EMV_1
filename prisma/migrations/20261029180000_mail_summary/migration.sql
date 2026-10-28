-- CreateTable
CREATE TABLE "MailSummary" (
    "userId" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "uidValidity" TEXT NOT NULL,
    "uid" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailSummary_pkey" PRIMARY KEY ("userId","folder","uidValidity","uid")
);

