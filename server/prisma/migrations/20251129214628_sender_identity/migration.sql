-- DropIndex
DROP INDEX "public"."Interaction_campaignId_userId_type_idx";

-- DropIndex
DROP INDEX "public"."Interaction_campaignUserId_type_idx";

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "senderIdentityId" INTEGER;

-- CreateTable
CREATE TABLE "SenderIdentity" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "replyTo" TEXT,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SenderIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SenderIdentity_tenantId_name_key" ON "SenderIdentity"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "SenderIdentity" ADD CONSTRAINT "SenderIdentity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_senderIdentityId_fkey" FOREIGN KEY ("senderIdentityId") REFERENCES "SenderIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
