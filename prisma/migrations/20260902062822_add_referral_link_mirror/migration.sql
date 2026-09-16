-- CreateTable
CREATE TABLE "referral_link_mirrors" (
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "cityName" VARCHAR(100),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_link_mirrors_pkey" PRIMARY KEY ("code")
);
