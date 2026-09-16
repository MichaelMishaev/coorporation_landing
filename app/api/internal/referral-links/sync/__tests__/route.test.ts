import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { POST } from "../route";

const TEST_SYNC_SECRET = "test-referral-link-sync-secret";
const originalSyncSecret = process.env.REFERRAL_LINK_SYNC_SECRET;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

beforeAll(async () => {
  process.env.REFERRAL_LINK_SYNC_SECRET = TEST_SYNC_SECRET;
  await prisma.$connect();
});

afterEach(async () => {
  await prisma.referralLinkMirror.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();

  if (originalSyncSecret === undefined) {
    delete process.env.REFERRAL_LINK_SYNC_SECRET;
  } else {
    process.env.REFERRAL_LINK_SYNC_SECRET = originalSyncSecret;
  }
});

function makeRequest(body: unknown, secret?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (secret !== undefined) {
    headers["X-Referral-Link-Sync-Secret"] = secret;
  }

  return new Request("http://localhost/api/internal/referral-links/sync", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/internal/referral-links/sync", () => {
  it("returns 401 for a missing or wrong secret and leaves the mirror table untouched", async () => {
    expect(await prisma.referralLinkMirror.count()).toBe(0);

    const missingSecretResponse = await POST(
      makeRequest({
        links: [{ code: "A", active: true, cityName: "חיפה" }],
      })
    );

    expect(missingSecretResponse.status).toBe(401);
    expect(await missingSecretResponse.json()).toEqual({ status: "error" });

    const wrongSecretResponse = await POST(
      makeRequest(
        {
          links: [{ code: "A", active: true, cityName: "חיפה" }],
        },
        "wrong-secret"
      )
    );

    expect(wrongSecretResponse.status).toBe(401);
    expect(await wrongSecretResponse.json()).toEqual({ status: "error" });
    expect(await prisma.referralLinkMirror.findMany()).toEqual([]);
  });

  it("creates exactly one matching mirror row from a valid full-list payload", async () => {
    const response = await POST(
      makeRequest(
        {
          links: [{ code: "A", active: true, cityName: "חיפה" }],
        },
        TEST_SYNC_SECRET
      )
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "success" });

    const rows = await prisma.referralLinkMirror.findMany();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      code: "A",
      active: true,
      cityName: "חיפה",
    });
  });

  it("deactivates an omitted existing code without deleting it and creates the replacement code", async () => {
    const firstResponse = await POST(
      makeRequest(
        {
          links: [{ code: "A", active: true, cityName: "חיפה" }],
        },
        TEST_SYNC_SECRET
      )
    );

    expect(firstResponse.status).toBe(200);
    expect(await firstResponse.json()).toEqual({ status: "success" });

    const secondResponse = await POST(
      makeRequest(
        {
          links: [{ code: "B", active: true, cityName: null }],
        },
        TEST_SYNC_SECRET
      )
    );

    expect(secondResponse.status).toBe(200);
    expect(await secondResponse.json()).toEqual({ status: "success" });

    const rows = await prisma.referralLinkMirror.findMany({
      orderBy: { code: "asc" },
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      code: "A",
      active: false,
      cityName: "חיפה",
    });
    expect(rows[1]).toMatchObject({
      code: "B",
      active: true,
      cityName: null,
    });

    expect(await prisma.referralLinkMirror.findUnique({ where: { code: "A" } })).not.toBeNull();
  });

  it("accepts an empty full list, deactivates every active row, and deletes none", async () => {
    const seedResponse = await POST(
      makeRequest(
        {
          links: [
            { code: "A", active: true, cityName: "חיפה" },
            { code: "B", active: true, cityName: null },
          ],
        },
        TEST_SYNC_SECRET
      )
    );

    expect(seedResponse.status).toBe(200);
    expect(await prisma.referralLinkMirror.count()).toBe(2);

    const response = await POST(
      makeRequest(
        {
          links: [],
        },
        TEST_SYNC_SECRET
      )
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "success" });

    const rows = await prisma.referralLinkMirror.findMany({
      orderBy: { code: "asc" },
    });

    expect(rows).toHaveLength(2);
    expect(rows.map(({ code, active }) => ({ code, active }))).toEqual([
      { code: "A", active: false },
      { code: "B", active: false },
    ]);
  });

  it("returns 400 for missing or non-array links and leaves existing rows untouched", async () => {
    const seedResponse = await POST(
      makeRequest(
        {
          links: [{ code: "A", active: true, cityName: "חיפה" }],
        },
        TEST_SYNC_SECRET
      )
    );

    expect(seedResponse.status).toBe(200);

    const rowsBeforeInvalidRequests = await prisma.referralLinkMirror.findMany({
      orderBy: { code: "asc" },
    });

    const missingLinksResponse = await POST(makeRequest({}, TEST_SYNC_SECRET));
    expect(missingLinksResponse.status).toBe(400);
    expect(await missingLinksResponse.json()).toEqual({ status: "error" });

    const nonArrayLinksResponse = await POST(
      makeRequest({ links: "not-an-array" }, TEST_SYNC_SECRET)
    );
    expect(nonArrayLinksResponse.status).toBe(400);
    expect(await nonArrayLinksResponse.json()).toEqual({ status: "error" });

    const rowsAfterInvalidRequests = await prisma.referralLinkMirror.findMany({
      orderBy: { code: "asc" },
    });

    expect(rowsAfterInvalidRequests).toEqual(rowsBeforeInvalidRequests);
  });
});
