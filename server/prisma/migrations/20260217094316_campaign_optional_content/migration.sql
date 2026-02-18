-- DropForeignKey
ALTER TABLE "public"."Campaign" DROP CONSTRAINT "Campaign_senderIdentityId_fkey";

-- AlterTable
ALTER TABLE "Campaign" ALTER COLUMN "emailTemplateId" DROP NOT NULL,
ALTER COLUMN "landingPageId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_senderIdentityId_fkey" FOREIGN KEY ("senderIdentityId") REFERENCES "SenderIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
