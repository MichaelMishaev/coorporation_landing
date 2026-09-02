import { describe, it, expect } from "vitest";
import { computePayloadDigest } from "../submit-signup";

describe("computePayloadDigest with referralCode", () => {
  it("produces a different digest when referralCode differs, all else equal", () => {
    const a = computePayloadDigest({ fullName: "משה כהן", phone: "0501234567", cityName: "תל אביב", referralCode: "code-a" });
    const b = computePayloadDigest({ fullName: "משה כהן", phone: "0501234567", cityName: "תל אביב", referralCode: "code-b" });
    expect(a).not.toBe(b);
  });

  it("produces the same digest when referralCode is the same", () => {
    const a = computePayloadDigest({ fullName: "משה כהן", phone: "0501234567", cityName: "תל אביב", referralCode: "code-a" });
    const b = computePayloadDigest({ fullName: "משה כהן", phone: "0501234567", cityName: "תל אביב", referralCode: "code-a" });
    expect(a).toBe(b);
  });

  it("produces the same digest as before when referralCode is undefined on both sides (backward compat)", () => {
    const a = computePayloadDigest({ fullName: "משה כהן", phone: "0501234567", cityName: "תל אביב" });
    const b = computePayloadDigest({ fullName: "משה כהן", phone: "0501234567", cityName: "תל אביב" });
    expect(a).toBe(b);
  });
});
