/*
  Warnings:

  - You are about to drop the column `fromEmail` on the `SenderIdentity` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tenantId,senderDomainId,localPart]` on the table `SenderIdentity` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `localPart` to the `SenderIdentity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `senderDomainId` to the `SenderIdentity` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SenderIdentity" DROP COLUMN "fromEmail",
ADD COLUMN     "localPart" TEXT NOT NULL,
ADD COLUMN     "senderDomainId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "SenderDomain" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "domain" TEXT NOT NULL,
    "label" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SenderDomain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SenderDomain_tenantId_domain_key" ON "SenderDomain"("tenantId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "SenderIdentity_tenantId_senderDomainId_localPart_key" ON "SenderIdentity"("tenantId", "senderDomainId", "localPart");

-- AddForeignKey
ALTER TABLE "SenderDomain" ADD CONSTRAINT "SenderDomain_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SenderIdentity" ADD CONSTRAINT "SenderIdentity_senderDomainId_fkey" FOREIGN KEY ("senderDomainId") REFERENCES "SenderDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
