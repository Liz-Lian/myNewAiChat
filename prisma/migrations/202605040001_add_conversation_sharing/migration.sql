-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "shareToken" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "isShared" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Conversation" ADD COLUMN "sharedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_shareToken_key" ON "Conversation"("shareToken");
