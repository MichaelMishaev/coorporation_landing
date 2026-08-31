import { createHash } from "crypto";
import { Prisma, type PrismaClient } from "@prisma/client";

export type SubmitSignupInput = {
  fullName: string;
  phone: string;
  cityName: string | null;
  clientSubmissionId: string;
  ip: string;
  honeypotTripped: boolean;
};

export type SubmitSignupResult =
  | { type: "success" }
  | { type: "conflict" }
  | { type: "rateLimited" };

/**
 * Starting default per spec.md's "Open items" ("not before first real
 * event" deferral) — a real, committed number, adjustable later without
 * a redesign, not a placeholder.
 */
const RATE_LIMIT_THRESHOLD = 5;

function computePayloadDigest(input: {
  fullName: string;
  phone: string;
  cityName: string | null;
}): string {
  const normalized = JSON.stringify({
    fullName: input.fullName,
    phone: input.phone,
    cityName: input.cityName,
  });
  return createHash("sha256").update(normalized).digest("hex");
}

function currentWindowStart(): Date {
  const now = new Date();
  now.setSeconds(0, 0);
  return now;
}

/**
 * Old buckets are never queried again once their window has passed —
 * spec.md's "SignupRateLimitBucket" section calls periodic cleanup "a
 * trivial implementation-time addition, not architectural." This is
 * that addition: cheap, probabilistic, non-blocking. It never delays or
 * fails the request it happens to run alongside — a failed cleanup is
 * logged and swallowed, not surfaced to the caller.
 */
const CLEANUP_PROBABILITY = 0.01;
const CLEANUP_RETENTION_WINDOWS = 10;

function cleanupStaleBuckets(prisma: PrismaClient, currentWindow: Date): void {
  if (Math.random() >= CLEANUP_PROBABILITY) return;
  const cutoff = new Date(currentWindow.getTime() - CLEANUP_RETENTION_WINDOWS * 60_000);
  prisma.signupRateLimitBucket
    .deleteMany({ where: { windowStart: { lt: cutoff } } })
    .catch((err) => {
      console.error("signup rate-limit bucket cleanup failed", err);
    });
}

async function checkIdempotency(
  prisma: PrismaClient,
  clientSubmissionId: string,
  digest: string
): Promise<SubmitSignupResult | null> {
  const existing = await prisma.supportSignup.findUnique({
    where: { clientSubmissionId },
    select: { payloadDigest: true },
  });
  if (!existing) return null;
  return existing.payloadDigest === digest ? { type: "success" } : { type: "conflict" };
}

export async function submitSignup(
  prisma: PrismaClient,
  input: SubmitSignupInput
): Promise<SubmitSignupResult> {
  const digest = computePayloadDigest(input);

  // Step 1: idempotency check (read-only, always runs first)
  const replayResult = await checkIdempotency(prisma, input.clientSubmissionId, digest);
  if (replayResult) return replayResult;

  // Step 2: atomic rate limit check (only reached for a genuinely new attempt)
  const windowStart = currentWindowStart();
  const bucket = await prisma.signupRateLimitBucket.upsert({
    where: { ip_windowStart: { ip: input.ip, windowStart } },
    create: { ip: input.ip, windowStart, count: 1 },
    update: { count: { increment: 1 } },
  });
  cleanupStaleBuckets(prisma, windowStart);
  if (bucket.count > RATE_LIMIT_THRESHOLD) {
    return { type: "rateLimited" };
  }

  // Step 3: write (only reached after both checks pass)
  try {
    await prisma.supportSignup.create({
      data: {
        fullName: input.fullName,
        phone: input.phone,
        cityName: input.cityName,
        clientSubmissionId: input.clientSubmissionId,
        payloadDigest: digest,
        ip: input.ip,
        honeypotTripped: input.honeypotTripped,
      },
    });
    return { type: "success" };
  } catch (err) {
    // Rare race: another request inserted the same brand-new
    // clientSubmissionId between Step 1's read and this write. Prisma's
    // unique-constraint violation (P2002) plays the role of the spec's
    // "ON CONFLICT DO NOTHING" — re-run Step 1's lookup-and-compare logic
    // against the now-existing row, same replay-vs-conflict branching.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const raceResult = await checkIdempotency(prisma, input.clientSubmissionId, digest);
      if (raceResult) return raceResult;
    }
    throw err;
  }
}
