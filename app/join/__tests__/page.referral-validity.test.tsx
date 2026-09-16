import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    referralLinkMirror: { findUnique },
  },
}));

import JoinPage from "../page";

describe("JoinPage referral validity", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("forwards an active referral code to the signup form", async () => {
    findUnique.mockResolvedValue({ active: true, cityName: "חיפה" });

    const result = await JoinPage({ searchParams: Promise.resolve({ ref: "active-code" }) });

    expect(result.props).toMatchObject({ referralCode: "active-code", prefillCity: "חיפה" });
  });

  it.each([
    ["revoked", { active: false, cityName: "חיפה" }],
    ["unknown", null],
  ])("does not attribute an %s referral URL", async (_label, mirrored) => {
    findUnique.mockResolvedValue(mirrored);

    const result = await JoinPage({ searchParams: Promise.resolve({ ref: "old-code" }) });

    expect(result.props).toMatchObject({ referralCode: undefined, prefillCity: undefined });
  });
});
