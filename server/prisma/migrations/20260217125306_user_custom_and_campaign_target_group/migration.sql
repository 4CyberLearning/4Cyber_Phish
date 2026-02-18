-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "targetGroupId" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "custom" JSONB,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_targetGroupId_fkey" FOREIGN KEY ("targetGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
