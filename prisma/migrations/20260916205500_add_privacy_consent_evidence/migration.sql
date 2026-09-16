ALTER TABLE "support_signups"
ADD COLUMN "privacy_accepted_at" TIMESTAMPTZ,
ADD COLUMN "privacy_policy_version" VARCHAR(64);
