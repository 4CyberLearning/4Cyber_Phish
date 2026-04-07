BEGIN;

CREATE TYPE "ContentLanguage" AS ENUM (
  'CZ',
  'EN',
  'DE',
  'FR',
  'IT',
  'ES',
  'PL',
  'NL',
  'SK',
  'HU',
  'RO',
  'PT'
);

ALTER TABLE "EmailTemplate"
  ADD COLUMN "language" "ContentLanguage";

ALTER TABLE "LandingPage"
  ADD COLUMN "language" "ContentLanguage";

ALTER TABLE "CampaignPackage"
  ADD COLUMN "language" "ContentLanguage";

UPDATE "EmailTemplate"
SET "language" = 'CZ'::"ContentLanguage"
WHERE "language" IS NULL;

UPDATE "LandingPage"
SET "language" = 'CZ'::"ContentLanguage"
WHERE "language" IS NULL;

UPDATE "CampaignPackage"
SET "language" = 'CZ'::"ContentLanguage"
WHERE "language" IS NULL;

ALTER TABLE "EmailTemplate"
  ALTER COLUMN "language" SET DEFAULT 'CZ'::"ContentLanguage",
  ALTER COLUMN "language" SET NOT NULL;

ALTER TABLE "LandingPage"
  ALTER COLUMN "language" SET DEFAULT 'CZ'::"ContentLanguage",
  ALTER COLUMN "language" SET NOT NULL;

ALTER TABLE "CampaignPackage"
  ALTER COLUMN "language" SET DEFAULT 'CZ'::"ContentLanguage",
  ALTER COLUMN "language" SET NOT NULL;

DROP INDEX IF EXISTS "EmailTemplate_tenantId_name_key";
CREATE UNIQUE INDEX "EmailTemplate_tenantId_language_name_key"
  ON "EmailTemplate"("tenantId", "language", "name");

CREATE INDEX "EmailTemplate_tenantId_language_createdAt_idx"
  ON "EmailTemplate"("tenantId", "language", "createdAt");

CREATE INDEX "LandingPage_tenantId_language_createdAt_idx"
  ON "LandingPage"("tenantId", "language", "createdAt");

DROP INDEX IF EXISTS "CampaignPackage_tenantId_name_key";
DROP INDEX IF EXISTS "CampaignPackage_tenantId_isActive_isApproved_idx";

CREATE UNIQUE INDEX "CampaignPackage_tenantId_language_name_key"
  ON "CampaignPackage"("tenantId", "language", "name");

CREATE INDEX "CampaignPackage_tenantId_language_isActive_isApproved_idx"
  ON "CampaignPackage"("tenantId", "language", "isActive", "isApproved");

ALTER TABLE "EmailTemplate"
  DROP COLUMN "difficulty";

ALTER TABLE "CampaignPackage"
  DROP COLUMN "difficulty";

COMMIT;