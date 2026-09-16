/*
  Warnings:

  - The required column `id` was added to the `signup_rate_limit_buckets` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "signup_rate_limit_buckets" ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "signup_rate_limit_buckets_pkey" PRIMARY KEY ("id");
