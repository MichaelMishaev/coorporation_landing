import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { jsonResponse, renderForm, submittedBody } from "./test-utils";

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));
}

describe("SignupForm clientSubmissionId lifecycle", () => {
  it("reuses the same id across a retry after an ambiguous (network) failure with an unchanged payload", async () => {
    const user = userEvent.setup();
    let call = 0;
    const fetchMock = renderForm(() => {
      call += 1;
      if (call === 1) return Promise.reject(new Error("network down"));
      return Promise.resolve(jsonResponse({ status: "success" }));
    });
    await user.type(screen.getByLabelText(/שם מלא/), "ישראל ישראלי");
    await user.type(screen.getByLabelText(/טלפון נייד/), "0501234567");

    await fillAndSubmit(user);
    await screen.findByText("אירעה שגיאה. נסו שוב בעוד רגע.");
    await fillAndSubmit(user);

    await vi.waitFor(() => {
      const first = submittedBody(fetchMock, 0);
      const second = submittedBody(fetchMock, 1);
      expect(second.clientSubmissionId).toBe(first.clientSubmissionId);
    });
  });

  it("mints a fresh id after a definitive (non-ok) response, even on an unmodified resubmit", async () => {
    const user = userEvent.setup();
    let call = 0;
    const fetchMock = renderForm(() => {
      call += 1;
      if (call === 1) return Promise.resolve(jsonResponse({ status: "error" }, 400));
      return Promise.resolve(jsonResponse({ status: "success" }));
    });
    await user.type(screen.getByLabelText(/שם מלא/), "ישראל ישראלי");
    await user.type(screen.getByLabelText(/טלפון נייד/), "0501234567");

    await fillAndSubmit(user);
    await screen.findByText("אירעה שגיאה. נסו שוב בעוד רגע.");
    await fillAndSubmit(user);

    await vi.waitFor(() => {
      const first = submittedBody(fetchMock, 0);
      const second = submittedBody(fetchMock, 1);
      expect(second.clientSubmissionId).not.toBe(first.clientSubmissionId);
    });
  });

  it("mints a fresh id when a field is edited after any failed attempt", async () => {
    const user = userEvent.setup();
    const fetchMock = renderForm(() => Promise.reject(new Error("network down")));
    await user.type(screen.getByLabelText(/שם מלא/), "ישראל ישראלי");
    await user.type(screen.getByLabelText(/טלפון נייד/), "0501234567");
    await fillAndSubmit(user);
    await screen.findByText("אירעה שגיאה. נסו שוב בעוד רגע.");

    await user.type(screen.getByLabelText(/שם מלא/), "י");

    const firstBody = submittedBody(fetchMock, 0);
    await fillAndSubmit(user).catch(() => {});
    await vi.waitFor(() => {
      const secondBody = submittedBody(fetchMock, 1);
      expect(secondBody.clientSubmissionId).not.toBe(firstBody.clientSubmissionId);
    });
  });
});
