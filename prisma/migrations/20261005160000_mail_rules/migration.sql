-- CreateTable
CREATE TABLE "MailRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "matchAll" BOOLEAN NOT NULL DEFAULT true,
    "conditions" JSONB NOT NULL,
    "attachments" TEXT NOT NULL DEFAULT 'any',
    "moveTo" TEXT,
    "markRead" BOOLEAN NOT NULL DEFAULT false,
    "flag" BOOLEAN NOT NULL DEFAULT false,
    "remove" BOOLEAN NOT NULL DEFAULT false,
    "forwardTo" TEXT,
    "replyText" TEXT,
    "stopProcessing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailRuleState" (
    "userId" TEXT NOT NULL,
    "uidValidity" TEXT NOT NULL,
    "lastUid" INTEGER NOT NULL,
    "replied" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailRuleState_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "MailRule_userId_position_idx" ON "MailRule"("userId", "position");

-- AddForeignKey
ALTER TABLE "MailRule" ADD CONSTRAINT "MailRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailRuleState" ADD CONSTRAINT "MailRuleState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

