/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,integrationCompanyScope,domain]` on the table `AllowedRecipientDomain` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,integrationCompanyScope,name]` on the table `Group` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,integrationCompanyScope,email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,integrationCompanyScope,externalUserPublicId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."AllowedRecipientDomain_tenantId_domain_key";

-- DropIndex
DROP INDEX "public"."Campaign_tenantId_status_cutoffAt_idx";

-- DropIndex
DROP INDEX "public"."Campaign_tenantId_status_scheduledAt_idx";

-- DropIndex
DROP INDEX "public"."Group_tenantId_name_key";

-- DropIndex
DROP INDEX "public"."User_externalUserPublicId_idx";

-- DropIndex
DROP INDEX "public"."User_tenantId_email_key";

-- DropIndex
DROP INDEX "public"."User_tenantId_externalUserPublicId_key";

-- DropIndex
DROP INDEX "public"."User_tenantId_isActive_idx";

-- AlterTable
ALTER TABLE "AllowedRecipientDomain" ADD COLUMN     "integrationCompanyScope" TEXT NOT NULL DEFAULT '__legacy__';

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "integrationCompanyScope" TEXT NOT NULL DEFAULT '__legacy__',
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "integrationCompanyScope" TEXT NOT NULL DEFAULT '__legacy__';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "integrationCompanyScope" TEXT NOT NULL DEFAULT '__legacy__';

-- CreateIndex
CREATE INDEX "AllowedRecipientDomain_tenantId_integrationCompanyScope_idx" ON "AllowedRecipientDomain"("tenantId", "integrationCompanyScope");

-- CreateIndex
CREATE UNIQUE INDEX "AllowedRecipientDomain_tenantId_integrationCompanyScope_dom_key" ON "AllowedRecipientDomain"("tenantId", "integrationCompanyScope", "domain");

-- CreateIndex
CREATE INDEX "Campaign_tenantId_integrationCompanyScope_status_scheduledA_idx" ON "Campaign"("tenantId", "integrationCompanyScope", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Campaign_tenantId_integrationCompanyScope_status_cutoffAt_idx" ON "Campaign"("tenantId", "integrationCompanyScope", "status", "cutoffAt");

-- CreateIndex
CREATE INDEX "Group_tenantId_integrationCompanyScope_idx" ON "Group"("tenantId", "integrationCompanyScope");

-- CreateIndex
CREATE UNIQUE INDEX "Group_tenantId_integrationCompanyScope_name_key" ON "Group"("tenantId", "integrationCompanyScope", "name");

-- CreateIndex
CREATE INDEX "User_tenantId_integrationCompanyScope_externalUserPublicId_idx" ON "User"("tenantId", "integrationCompanyScope", "externalUserPublicId");

-- CreateIndex
CREATE INDEX "User_tenantId_integrationCompanyScope_isActive_idx" ON "User"("tenantId", "integrationCompanyScope", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_integrationCompanyScope_email_key" ON "User"("tenantId", "integrationCompanyScope", "email");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_integrationCompanyScope_externalUserPublicId_key" ON "User"("tenantId", "integrationCompanyScope", "externalUserPublicId");
