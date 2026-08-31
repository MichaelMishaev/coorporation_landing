import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderForm, submittedBody } from "./test-utils";

describe("SignupForm name validation", () => {
  it("blocks submission and shows an inline error for a whitespace-only name", async () => {
    const user = userEvent.setup();
    const fetchMock = renderForm();
    await user.type(screen.getByLabelText(/שם מלא/), "   ");
    await user.type(screen.getByLabelText(/טלפון נייד/), "0501234567");
    await user.click(screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));

    expect(await screen.findByText("אנא הזן שם מלא")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the trimmed name on a successful submit", async () => {
    const user = userEvent.setup();
    const fetchMock = renderForm();
    await user.type(screen.getByLabelText(/שם מלא/), "  ישראל ישראלי  ");
    await user.type(screen.getByLabelText(/טלפון נייד/), "0501234567");
    await user.click(screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));

    await vi.waitFor(() => {
      const body = submittedBody(fetchMock);
      expect(body.fullName).toBe("ישראל ישראלי");
    });
  });
});
