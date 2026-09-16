import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET } from "../route";

const TEST_EXPORT_SECRET = "test-signup-export-secret";
const TEST_MARKER = "signup-export-route-test";
const INTERNAL_RATE_LIMIT_KEY = "signup-export";
const originalExportSecret = process.env.SIGNUP_EXPORT_SECRET;

const createdSignupIds: string[] = [];
let rateLimitBucketsBeforeEach = new Map<string, number>();

type ExportedSignup = {
  id: string;
  fullName: string;
  phone: string;
  cityName: string | null;
  referralCode: string | null;
  privacyAcceptedAt: string | null;
  privacyPolicyVersion: string | null;
  createdAt: string;
};

type ExportResponse = {
  signups: ExportedSignup[];
  nextCursor: string | null;
};

beforeEach(async () => {
  process.env.SIGNUP_EXPORT_SECRET = TEST_EXPORT_SECRET;

  const buckets = await prisma.signupRateLimitBucket.findMany({
    where: { ip: INTERNAL_RATE_LIMIT_KEY },
    select: { id: true, count: true },
  });
  rateLimitBucketsBeforeEach = new Map(buckets.map((bucket) => [bucket.id, bucket.count]));
});

afterEach(async () => {
  if (createdSignupIds.length > 0) {
    await prisma.supportSignup.deleteMany({ where: { id: { in: createdSignupIds } } });
    createdSignupIds.length = 0;
  }

  const bucketsAfterTest = await prisma.signupRateLimitBucket.findMany({
    where: { ip: INTERNAL_RATE_LIMIT_KEY },
    select: { id: true },
  });
  const bucketIdsCreatedByThisTest = bucketsAfterTest
    .map((bucket) => bucket.id)
    .filter((id) => !rateLimitBucketsBeforeEach.has(id));

  if (bucketIdsCreatedByThisTest.length > 0) {
    await prisma.signupRateLimitBucket.deleteMany({
      where: { id: { in: bucketIdsCreatedByThisTest } },
    });
  }

  await Promise.all(
    [...rateLimitBucketsBeforeEach].map(([id, count]) =>
      prisma.signupRateLimitBucket.update({ where: { id }, data: { count } })
    )
  );

  if (originalExportSecret === undefined) {
    delete process.env.SIGNUP_EXPORT_SECRET;
  } else {
    process.env.SIGNUP_EXPORT_SECRET = originalExportSecret;
  }
});

function makeRequest(options: { cursor?: string; limit?: number; secret?: string } = {}) {
  const url = new URL("http://localhost/api/internal/signups/export");
  if (options.cursor !== undefined) url.searchParams.set("cursor", options.cursor);
  if (options.limit !== undefined) url.searchParams.set("limit", String(options.limit));

  const headers = new Headers();
  if (options.secret !== undefined) {
    headers.set("X-Signup-Export-Secret", options.secret);
  }

  return new NextRequest(url, { method: "GET", headers });
}

async function createSignup(overrides: {
  createdAt?: Date;
  honeypotTripped?: boolean;
  suffix: string;
}) {
  const signup = await prisma.supportSignup.create({
    data: {
      fullName: `${TEST_MARKER} ${overrides.suffix}`,
      phone: `050${String(createdSignupIds.length + 1000000).slice(-7)}`,
      cityName: "Test City",
      referralCode: `${TEST_MARKER}-${overrides.suffix}`,
      clientSubmissionId: crypto.randomUUID(),
      payloadDigest: `${TEST_MARKER}-digest-${crypto.randomUUID()}`,
      ip: `${TEST_MARKER}-${overrides.suffix}`,
      honeypotTripped: overrides.honeypotTripped ?? false,
      privacyAcceptedAt: new Date(),
      privacyPolicyVersion: "amchaisrael-privacy-v1",
      ...(overrides.createdAt === undefined ? {} : { createdAt: overrides.createdAt }),
    },
  });
  createdSignupIds.push(signup.id);
  return signup;
}

describe("GET /api/internal/signups/export", () => {
  it("returns 401 without exposing signup data when the secret is missing or wrong", async () => {
    const sensitiveSignup = await createSignup({ suffix: "unauthorized", honeypotTripped: false });

    for (const secret of [undefined, "wrong-secret"]) {
      const response = await GET(makeRequest({ secret }));
      expect(response.status).toBe(401);
      const body = await response.text();
      expect(body).not.toContain(sensitiveSignup.id);
      expect(body).not.toContain(sensitiveSignup.fullName);
      expect(body).not.toContain(sensitiveSignup.phone);
    }
  });

  it("never exports honeypot-tripped rows, including across cursor and limit requests", async () => {
    const baseTime = Date.now() - 10_000;
    const firstRealSignup = await createSignup({
      suffix: "first-real",
      createdAt: new Date(baseTime),
    });
    const honeypotSignup = await createSignup({
      suffix: "honeypot",
      honeypotTripped: true,
      createdAt: new Date(baseTime + 1_000),
    });
    const secondRealSignup = await createSignup({
      suffix: "second-real",
      createdAt: new Date(baseTime + 2_000),
    });

    const firstResponse = await GET(makeRequest({ secret: TEST_EXPORT_SECRET, limit: 1 }));
    expect(firstResponse.status).toBe(200);
    const firstPage = (await firstResponse.json()) as ExportResponse;
    expect(firstPage.signups.map((signup) => signup.id)).toEqual([firstRealSignup.id]);
    expect(firstPage.signups.map((signup) => signup.id)).not.toContain(honeypotSignup.id);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondResponse = await GET(
      makeRequest({ secret: TEST_EXPORT_SECRET, cursor: firstPage.nextCursor!, limit: 2 })
    );
    expect(secondResponse.status).toBe(200);
    const secondPage = (await secondResponse.json()) as ExportResponse;
    expect(secondPage.signups.map((signup) => signup.id)).toEqual([secondRealSignup.id]);
    expect(secondPage.signups.map((signup) => signup.id)).not.toContain(honeypotSignup.id);
  });

  it("exports only the explicitly allowed fields", async () => {
    await createSignup({ suffix: "field-allowlist" });

    const response = await GET(makeRequest({ secret: TEST_EXPORT_SECRET }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as ExportResponse;
    const returnedSignup = body.signups.find((signup) => signup.fullName.includes("field-allowlist"));

    expect(returnedSignup).toBeDefined();
    expect(Object.keys(returnedSignup!)).toEqual([
      "id",
      "fullName",
      "phone",
      "cityName",
      "referralCode",
      "privacyAcceptedAt",
      "privacyPolicyVersion",
      "createdAt",
    ]);
  });

  it("returns oldest-first keyset pages and a null cursor after the last page", async () => {
    const baseTime = Date.now() - 20_000;
    const firstSignup = await createSignup({ suffix: "page-one", createdAt: new Date(baseTime) });
    const secondSignup = await createSignup({ suffix: "page-two", createdAt: new Date(baseTime + 1_000) });
    const thirdSignup = await createSignup({ suffix: "page-three", createdAt: new Date(baseTime + 2_000) });

    const firstResponse = await GET(makeRequest({ secret: TEST_EXPORT_SECRET, limit: 2 }));
    expect(firstResponse.status).toBe(200);
    const firstPage = (await firstResponse.json()) as ExportResponse;
    expect(firstPage.signups.map((signup) => signup.id)).toEqual([firstSignup.id, secondSignup.id]);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondResponse = await GET(
      makeRequest({ secret: TEST_EXPORT_SECRET, cursor: firstPage.nextCursor!, limit: 2 })
    );
    expect(secondResponse.status).toBe(200);
    const secondPage = (await secondResponse.json()) as ExportResponse;
    expect(secondPage.signups.map((signup) => signup.id)).toEqual([thirdSignup.id]);
    expect(secondPage.nextCursor).toBeNull();
  });

  it("increments the fixed internal per-minute SignupRateLimitBucket with upsert semantics", async () => {
    for (let requestNumber = 0; requestNumber < 5; requestNumber++) {
      const response = await GET(makeRequest({ secret: TEST_EXPORT_SECRET }));
      expect(response.status).toBe(200);
    }

    const bucketAfterAllowedRequests = await prisma.signupRateLimitBucket.findFirst({
      where: { ip: INTERNAL_RATE_LIMIT_KEY },
      orderBy: { windowStart: "desc" },
    });
    expect(bucketAfterAllowedRequests).not.toBeNull();

    const rateLimitedResponse = await GET(makeRequest({ secret: TEST_EXPORT_SECRET }));
    expect(rateLimitedResponse.status).toBe(429);

    const bucketAfterRejectedRequest = await prisma.signupRateLimitBucket.findUnique({
      where: {
        ip_windowStart: {
          ip: INTERNAL_RATE_LIMIT_KEY,
          windowStart: bucketAfterAllowedRequests!.windowStart,
        },
      },
    });
    expect(bucketAfterRejectedRequest?.count).toBe(bucketAfterAllowedRequests!.count + 1);
  });
});
