-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "packageId" INTEGER;

-- CreateTable
CREATE TABLE "CampaignPackage" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "previewText" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "emailTemplateId" INTEGER NOT NULL,
    "landingPageId" INTEGER NOT NULL,
    "senderIdentityId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignPackage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignPackage_tenantId_isActive_isApproved_idx" ON "CampaignPackage"("tenantId", "isActive", "isApproved");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignPackage_tenantId_name_key" ON "CampaignPackage"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "CampaignPackage" ADD CONSTRAINT "CampaignPackage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignPackage" ADD CONSTRAINT "CampaignPackage_emailTemplateId_fkey" FOREIGN KEY ("emailTemplateId") REFERENCES "EmailTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignPackage" ADD CONSTRAINT "CampaignPackage_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignPackage" ADD CONSTRAINT "CampaignPackage_senderIdentityId_fkey" FOREIGN KEY ("senderIdentityId") REFERENCES "SenderIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "CampaignPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
