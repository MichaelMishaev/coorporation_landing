import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderFormReady } from "./test-utils";

describe("SignupForm smoke test", () => {
  it("renders the form once the link and cities checks resolve", async () => {
    await renderFormReady();
    expect(screen.getByLabelText("שם מלא")).toBeInTheDocument();
  });
});
