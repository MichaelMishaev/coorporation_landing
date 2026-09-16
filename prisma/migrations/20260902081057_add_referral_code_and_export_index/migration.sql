-- AlterTable
ALTER TABLE "support_signups" ADD COLUMN     "referralCode" VARCHAR(64);

-- CreateIndex
CREATE INDEX "support_signups_createdAt_id_idx" ON "support_signups"("createdAt", "id");
