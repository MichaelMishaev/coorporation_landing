import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { SignupForm } from "../SignupForm";

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type FetchOverrides = Partial<Record<"link" | "cities" | "signup", FetchImpl>>;

export function installFetchMock(overrides: FetchOverrides = {}) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url.includes("/api/proxy/support-links/")) {
      return (overrides.link ?? (() => Promise.resolve(jsonResponse({ active: true }))))(
        url,
        init
      );
    }
    if (url.includes("/api/proxy/cities")) {
      return (
        overrides.cities ??
        (() => Promise.resolve(jsonResponse({ cities: [{ id: "city-1", name: "תל אביב" }] })))
      )(url, init);
    }
    if (url.includes("/api/proxy/support-signup")) {
      return (overrides.signup ?? (() => Promise.resolve(jsonResponse({ status: "success" }))))(
        url,
        init
      );
    }
    return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Renders SignupForm and waits until the link/cities check resolves and the
 * form is interactive. Returns the fetch mock so tests can inspect calls
 * made both before and during the test. */
export async function renderFormReady(overrides?: FetchOverrides) {
  const fetchMock = installFetchMock(overrides);
  render(<SignupForm linkCode="test-code" />);
  await waitFor(() => screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));
  return fetchMock;
}

/** Parses the JSON body of a given fetch mock call. */
export function submittedBody(fetchMock: ReturnType<typeof installFetchMock>, callIndex = 0) {
  const signupCalls = fetchMock.mock.calls.filter(([url]) =>
    String(url).includes("/api/proxy/support-signup")
  );
  const [, init] = signupCalls[callIndex];
  return JSON.parse(String(init?.body));
}
