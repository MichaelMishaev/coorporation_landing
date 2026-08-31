import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { SignupForm } from "../SignupForm";

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function installFetchMock(signupImpl?: FetchImpl) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const pathname = new URL(url, "http://localhost").pathname;
    if (pathname === "/api/signup") {
      return (signupImpl ?? (() => Promise.resolve(jsonResponse({ status: "success" }))))(
        url,
        init
      );
    }
    return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Renders SignupForm (now a zero-prop component — no network calls on
 * mount, so this is synchronous, unlike the old renderFormReady). */
export function renderForm(signupImpl?: FetchImpl) {
  const fetchMock = installFetchMock(signupImpl);
  render(<SignupForm />);
  return fetchMock;
}

export function submittedBody(fetchMock: ReturnType<typeof installFetchMock>, callIndex = 0) {
  const [, init] = fetchMock.mock.calls[callIndex];
  return JSON.parse(String(init?.body));
}

// Re-exported for tests that need direct screen access alongside the helpers above.
export { screen };
