/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `LandingPage` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[trackingToken]` on the table `CampaignUser` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[urlSlug]` on the table `LandingPage` will be added. If there are existing duplicate values, this will fail.
  - The required column `trackingToken` was added to the `CampaignUser` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `campaignUserId` to the `Interaction` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."LandingPage_tenantId_urlSlug_key";

-- AlterTable
ALTER TABLE "CampaignUser" ADD COLUMN     "clickedAt" TIMESTAMP(3),
ADD COLUMN     "openedAt" TIMESTAMP(3),
ADD COLUMN     "reportedAt" TIMESTAMP(3),
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "trackingToken" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Interaction" ADD COLUMN     "campaignUserId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "LandingPage" DROP COLUMN "updatedAt";

-- CreateIndex
CREATE UNIQUE INDEX "CampaignUser_trackingToken_key" ON "CampaignUser"("trackingToken");

-- CreateIndex
CREATE INDEX "Interaction_campaignUserId_type_idx" ON "Interaction"("campaignUserId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "LandingPage_urlSlug_key" ON "LandingPage"("urlSlug");

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_campaignUserId_fkey" FOREIGN KEY ("campaignUserId") REFERENCES "CampaignUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
