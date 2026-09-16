-- CreateTable
CREATE TABLE "support_signups" (
    "id" TEXT NOT NULL,
    "fullName" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "cityName" VARCHAR(100),
    "clientSubmissionId" TEXT NOT NULL,
    "payloadDigest" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "honeypotTripped" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_signups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signup_rate_limit_buckets" (
    "ip" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "support_signups_clientSubmissionId_key" ON "support_signups"("clientSubmissionId");

-- CreateIndex
CREATE UNIQUE INDEX "signup_rate_limit_buckets_ip_windowStart_key" ON "signup_rate_limit_buckets"("ip", "windowStart");
