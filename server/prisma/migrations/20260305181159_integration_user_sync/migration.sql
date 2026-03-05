/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,externalUserPublicId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "externalUserPublicId" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "User_externalUserPublicId_idx" ON "User"("externalUserPublicId");

-- CreateIndex
CREATE INDEX "User_tenantId_isActive_idx" ON "User"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_externalUserPublicId_key" ON "User"("tenantId", "externalUserPublicId");
