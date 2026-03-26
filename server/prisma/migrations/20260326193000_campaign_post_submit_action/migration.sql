-- Add campaign post-submit behavior configuration
CREATE TYPE "CampaignPostSubmitActionType" AS ENUM ('TRAINING_PAGE', 'REDIRECT_URL');

ALTER TABLE "Campaign"
  ADD COLUMN "postSubmitActionType" "CampaignPostSubmitActionType" NOT NULL DEFAULT 'TRAINING_PAGE',
  ADD COLUMN "postSubmitRedirectUrl" TEXT;
