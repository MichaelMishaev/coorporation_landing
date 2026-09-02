import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SignupForm } from "../SignupForm";

describe("SignupForm referral city prefill", () => {
  it("pre-selects the given city when prefillCity is provided", () => {
    render(<SignupForm prefillCity="חיפה" />);
    const combobox = screen.getByRole<HTMLInputElement>("combobox");
    expect(combobox.value).toBe("חיפה");
  });

  it("renders with no city selected when prefillCity is omitted", () => {
    render(<SignupForm />);
    const combobox = screen.getByRole<HTMLInputElement>("combobox");
    expect(combobox.value).toBe("");
  });
});
