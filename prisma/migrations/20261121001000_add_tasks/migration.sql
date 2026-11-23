-- Ensure the delivery-paid-by-recipient column exists (added manually earlier).
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryPaidByRecipient" BOOLEAN NOT NULL DEFAULT true;

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('INCOMING', 'OUTGOING');
CREATE TYPE "TaskBasis" AS ENUM ('INTERNAL', 'CUSTOMER_ORDER', 'BUYER_COMPANY', 'DOCUMENT_FLOW');
CREATE TYPE "TaskKind" AS ENUM ('LOGISTICS', 'INTERNAL_LOGISTICS', 'PROCESSING', 'SEND_EMAIL', 'CALL', 'APPROVE', 'REVIEW', 'DOCUMENTS', 'PAY', 'MEETING');
CREATE TYPE "TaskStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'OVERDUE', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "type" "TaskType" NOT NULL,
    "basis" "TaskBasis" NOT NULL,
    "kind" "TaskKind" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PLANNED',
    "description" TEXT NOT NULL,
    "response" TEXT,
    "creatorId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "parentId" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "sourceNumber" TEXT,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");
CREATE INDEX "Task_status_idx" ON "Task"("status");
CREATE INDEX "Task_start_idx" ON "Task"("start");
CREATE INDEX "Task_end_idx" ON "Task"("end");
CREATE INDEX "Task_parentId_idx" ON "Task"("parentId");
CREATE INDEX "Task_sourceType_sourceId_idx" ON "Task"("sourceType", "sourceId");

ALTER TABLE "Task" ADD CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
