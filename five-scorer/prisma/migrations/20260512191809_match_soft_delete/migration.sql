-- AlterTable
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Match_deletedAt_idx" ON "Match"("deletedAt");
