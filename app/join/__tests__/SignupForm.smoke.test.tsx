import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderForm } from "./test-utils";

describe("SignupForm smoke test", () => {
  it("renders the form immediately, with no network calls on mount", () => {
    const fetchMock = renderForm();
    expect(screen.getByLabelText("שם מלא")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
