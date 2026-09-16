import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { submitSignup, type SubmitSignupInput } from "../submit-signup";

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

function baseInput(overrides: Partial<SubmitSignupInput> = {}): SubmitSignupInput {
  return {
    fullName: "ישראל ישראלי",
    phone: "0501234567",
    cityName: "תל אביב-יפו",
    clientSubmissionId: crypto.randomUUID(),
    privacyAccepted: true,
    ip: "1.2.3.4",
    honeypotTripped: false,
    ...overrides,
  };
}

describe("submitSignup", () => {
  it("creates a new row on a fresh submission", async () => {
    const input = baseInput();
    const result = await submitSignup(prisma, input);
    expect(result).toEqual({ type: "success" });

    const rows = await prisma.supportSignup.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].clientSubmissionId).toBe(input.clientSubmissionId);
    expect(rows[0].privacyAcceptedAt).toBeInstanceOf(Date);
    expect(rows[0].privacyPolicyVersion).toBe("amchaisrael-privacy-v1");
  });

  it("returns success without creating a second row on an exact replay", async () => {
    const input = baseInput();
    await submitSignup(prisma, input);
    const second = await submitSignup(prisma, input);
    expect(second).toEqual({ type: "success" });

    const rows = await prisma.supportSignup.findMany();
    expect(rows).toHaveLength(1);
  });

  it("returns conflict, not the original data, when the same id is reused with a different payload", async () => {
    const id = crypto.randomUUID();
    await submitSignup(prisma, baseInput({ clientSubmissionId: id, fullName: "ישראל ישראלי" }));
    const second = await submitSignup(prisma, baseInput({ clientSubmissionId: id, fullName: "דנה כהן" }));
    expect(second).toEqual({ type: "conflict" });

    const rows = await prisma.supportSignup.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].fullName).toBe("ישראל ישראלי");
  });

  it("rejects once the rate limit threshold is hit and creates zero rows for the rejected attempt", async () => {
    const ip = "9.9.9.9";
    for (let i = 0; i < 5; i++) {
      const result = await submitSignup(prisma, baseInput({ ip, clientSubmissionId: crypto.randomUUID() }));
      expect(result).toEqual({ type: "success" });
    }
    const sixth = await submitSignup(prisma, baseInput({ ip, clientSubmissionId: crypto.randomUUID() }));
    expect(sixth).toEqual({ type: "rateLimited" });

    const rows = await prisma.supportSignup.findMany({ where: { ip } });
    expect(rows).toHaveLength(5);
  });

  it("does not exceed the rate limit cap under concurrent requests from the same IP", async () => {
    const ip = "8.8.8.8";
    const attempts = Array.from({ length: 8 }, () =>
      submitSignup(prisma, baseInput({ ip, clientSubmissionId: crypto.randomUUID() }))
    );
    const results = await Promise.all(attempts);
    const successCount = results.filter((r) => r.type === "success").length;
    expect(successCount).toBe(5);

    const rows = await prisma.supportSignup.findMany({ where: { ip } });
    expect(rows).toHaveLength(successCount);
  });
});
