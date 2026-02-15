-- CreateTable
CREATE TABLE "AllowedRecipientDomain" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "domain" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllowedRecipientDomain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AllowedRecipientDomain_tenantId_domain_key" ON "AllowedRecipientDomain"("tenantId", "domain");

-- AddForeignKey
ALTER TABLE "AllowedRecipientDomain" ADD CONSTRAINT "AllowedRecipientDomain_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
