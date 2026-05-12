-- DropForeignKey
ALTER TABLE "Goal" DROP CONSTRAINT IF EXISTS "Goal_assistId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Goal_assistId_idx";

-- AlterTable
ALTER TABLE "Goal" DROP COLUMN IF EXISTS "assistId";
