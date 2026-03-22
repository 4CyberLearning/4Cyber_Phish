CREATE TYPE "CampaignStatus_new" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'FINISHED', 'CANCELLED');
CREATE TYPE "CampaignSource" AS ENUM ('UNKNOWN', 'LOCAL_ADMIN', 'INTEGRATION', 'SCHEDULER');
CREATE TYPE "CampaignTargetType" AS ENUM ('GROUP', 'USER_LIST');
CREATE TYPE "CampaignLifecycleEventType" AS ENUM ('CREATED', 'SCHEDULED', 'STARTED', 'FINISHED', 'CANCELLED', 'UPDATED');
CREATE TYPE "CampaignActorType" AS ENUM ('SYSTEM', 'INTEGRATION', 'USER');

ALTER TABLE "Campaign"
  ADD COLUMN "cutoffAt" TIMESTAMP(3),
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "finishedAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "source" "CampaignSource" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "targetType" "CampaignTargetType" NOT NULL DEFAULT 'GROUP',
  ADD COLUMN "recipientCountSnapshot" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "statusReason" TEXT,
  ADD COLUMN "finishReason" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Campaign" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Campaign"
  ALTER COLUMN "status" TYPE "CampaignStatus_new"
  USING (
    CASE "status"::text
      WHEN 'ACTIVE' THEN 'RUNNING'
      WHEN 'CANCELED' THEN 'CANCELLED'
      ELSE "status"::text
    END
  )::"CampaignStatus_new";

ALTER TYPE "CampaignStatus" RENAME TO "CampaignStatus_old";
ALTER TYPE "CampaignStatus_new" RENAME TO "CampaignStatus";
DROP TYPE "CampaignStatus_old";

ALTER TABLE "Campaign" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';

UPDATE "Campaign" c
SET
  "targetType" = CASE
    WHEN c."targetGroupId" IS NOT NULL THEN 'GROUP'::"CampaignTargetType"
    ELSE 'USER_LIST'::"CampaignTargetType"
  END,
  "recipientCountSnapshot" = COALESCE(src.cnt, 0),
  "startedAt" = CASE
    WHEN c."status" = 'RUNNING' THEN COALESCE(c."startedAt", c."scheduledAt")
    WHEN c."status" = 'FINISHED' THEN COALESCE(c."startedAt", c."scheduledAt")
    WHEN c."status" = 'CANCELLED' THEN COALESCE(c."startedAt", NULL)
    ELSE c."startedAt"
  END,
  "finishedAt" = CASE
    WHEN c."status" = 'FINISHED' THEN COALESCE(c."finishedAt", CURRENT_TIMESTAMP)
    ELSE c."finishedAt"
  END,
  "cancelledAt" = CASE
    WHEN c."status" = 'CANCELLED' THEN COALESCE(c."cancelledAt", CURRENT_TIMESTAMP)
    ELSE c."cancelledAt"
  END
FROM (
  SELECT "campaignId", COUNT(*)::INTEGER AS cnt
  FROM "CampaignUser"
  GROUP BY "campaignId"
) src
WHERE src."campaignId" = c."id";

UPDATE "Campaign"
SET "recipientCountSnapshot" = 0
WHERE "recipientCountSnapshot" IS NULL;

CREATE TABLE "CampaignLifecycleEvent" (
  "id" SERIAL NOT NULL,
  "tenantId" INTEGER NOT NULL,
  "campaignId" INTEGER NOT NULL,
  "type" "CampaignLifecycleEventType" NOT NULL,
  "actorType" "CampaignActorType" NOT NULL DEFAULT 'SYSTEM',
  "actorUserId" INTEGER,
  "actorExternalId" TEXT,
  "actorEmail" TEXT,
  "actorName" TEXT,
  "actorSource" TEXT,
  "reason" TEXT,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignLifecycleEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Campaign_tenantId_status_scheduledAt_idx" ON "Campaign"("tenantId", "status", "scheduledAt");
CREATE INDEX "Campaign_tenantId_status_cutoffAt_idx" ON "Campaign"("tenantId", "status", "cutoffAt");
CREATE INDEX "CampaignLifecycleEvent_campaignId_createdAt_idx" ON "CampaignLifecycleEvent"("campaignId", "createdAt");
CREATE INDEX "CampaignLifecycleEvent_tenantId_createdAt_idx" ON "CampaignLifecycleEvent"("tenantId", "createdAt");

ALTER TABLE "CampaignLifecycleEvent"
  ADD CONSTRAINT "CampaignLifecycleEvent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignLifecycleEvent"
  ADD CONSTRAINT "CampaignLifecycleEvent_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
