import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { POST } from "../route";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

beforeAll(async () => {
  await prisma.$connect();
});

afterEach(async () => {
  await prisma.supportSignup.deleteMany();
  await prisma.signupRateLimitBucket.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function makeRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = { "x-forwarded-for": "1.2.3.4" }
) {
  return new Request("http://localhost/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/signup", () => {
  it("returns 200 success for a valid new signup", async () => {
    const response = await POST(
      makeRequest({
        fullName: "ישראל ישראלי",
        phone: "0501234567",
        cityName: "תל אביב-יפו",
        clientSubmissionId: crypto.randomUUID(),
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "success" });
  });

  it("returns 400 for a whitespace-only name", async () => {
    const response = await POST(
      makeRequest({
        fullName: "   ",
        phone: "0501234567",
        cityName: null,
        clientSubmissionId: crypto.randomUUID(),
      })
    );
    expect(response.status).toBe(400);
  });

  it("returns 409 with no leaked data when clientSubmissionId is reused with a different payload", async () => {
    const id = crypto.randomUUID();
    await POST(
      makeRequest({ fullName: "ישראל ישראלי", phone: "0501234567", cityName: null, clientSubmissionId: id })
    );
    const second = await POST(
      makeRequest({ fullName: "דנה כהן", phone: "0521112222", cityName: null, clientSubmissionId: id })
    );
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ status: "conflict" });
  });

  it("returns 200 success for a honeypot-tripped submission, indistinguishable from a real success", async () => {
    const response = await POST(
      makeRequest({
        fullName: "בוט",
        phone: "0500000000",
        cityName: null,
        clientSubmissionId: crypto.randomUUID(),
        website: "http://spam.example",
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "success" });

    const rows = await prisma.supportSignup.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].honeypotTripped).toBe(true);
  });

  it("trusts the rightmost X-Forwarded-For entry, not a client-supplied leftmost one", async () => {
    const response = await POST(
      makeRequest(
        { fullName: "א", phone: "0500000000", cityName: null, clientSubmissionId: crypto.randomUUID() },
        { "x-forwarded-for": "6.6.6.6, 7.7.7.7" }
      )
    );
    expect(response.status).toBe(200);
    const rows = await prisma.supportSignup.findMany();
    expect(rows[0].ip).toBe("7.7.7.7");
  });

  it("returns 400 when no client IP can be determined", async () => {
    const request = new Request("http://localhost/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "א",
        phone: "0500000000",
        cityName: null,
        clientSubmissionId: crypto.randomUUID(),
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 429 once the rate limit is exceeded, with zero rows written for the rejected request", async () => {
    const ip = "5.5.5.5";
    for (let i = 0; i < 5; i++) {
      const response = await POST(
        makeRequest(
          { fullName: "א", phone: "0500000000", cityName: null, clientSubmissionId: crypto.randomUUID() },
          { "x-forwarded-for": ip }
        )
      );
      expect(response.status).toBe(200);
    }
    const sixth = await POST(
      makeRequest(
        { fullName: "א", phone: "0500000000", cityName: null, clientSubmissionId: crypto.randomUUID() },
        { "x-forwarded-for": ip }
      )
    );
    expect(sixth.status).toBe(429);

    const rows = await prisma.supportSignup.findMany({ where: { ip } });
    expect(rows).toHaveLength(5);
  });
});
