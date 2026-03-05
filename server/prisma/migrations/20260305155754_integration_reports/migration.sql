/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,email]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."User_email_key";

-- AlterTable
ALTER TABLE "CampaignUser" ADD COLUMN     "externalUserPublicId" TEXT;

-- CreateTable
CREATE TABLE "IntegrationClient" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "IntegrationClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationClient_keyId_key" ON "IntegrationClient"("keyId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationClient_keyHash_key" ON "IntegrationClient"("keyHash");

-- CreateIndex
CREATE INDEX "IntegrationClient_tenantId_idx" ON "IntegrationClient"("tenantId");

-- CreateIndex
CREATE INDEX "CampaignUser_externalUserPublicId_idx" ON "CampaignUser"("externalUserPublicId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- AddForeignKey
ALTER TABLE "IntegrationClient" ADD CONSTRAINT "IntegrationClient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
