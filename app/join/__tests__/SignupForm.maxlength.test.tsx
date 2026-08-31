import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderForm } from "./test-utils";

describe("SignupForm input length limits", () => {
  it("caps the name input at 200 characters, matching the server schema", () => {
    renderForm();
    expect(screen.getByLabelText<HTMLInputElement>(/שם מלא/)).toHaveAttribute(
      "maxLength",
      "200"
    );
  });

});
