# Join Form Field Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `app/join/SignupForm.tsx` in line with the decided field-level
behavior in `docs/features/join-form/spec.md` — city becomes genuinely
optional (both in the UI and on the wire), name gets trimmed/validated
before any network call, name/phone get length parity with the server
schema, and the submission idempotency key gets a lifecycle that's actually
safe under retry. Each behavioral task is developed test-first against a
newly added Vitest suite.

**Architecture:** Task 0 adds a test framework (none existed before). Tasks
1-4 each modify `app/join/SignupForm.tsx` and add one new test file under
`app/join/__tests__/`, sharing one small fetch-mocking test helper. No
other application code changes; `SignupForm.module.css` needs no changes
(every behavior change here is logic/text, not visual).

**Tech Stack:** Next.js (App Router, client component), React 19
`useState`/`useRef`, Vitest 4 + `@testing-library/react` 16 +
`@testing-library/jest-dom` 7 + jsdom 30 (all added in Task 0).

**Spec:** `docs/features/join-form/spec.md` — acceptance criteria checked
against `docs/features/join-form/expected-result.md`.

## Global Constraints

- City is optional; name and phone stay mandatory (`spec.md` "Field requirements").
- A blank city must never be sent as `cityId: ""` — the key must be omitted entirely (`spec.md` "City handling").
- No client-side request timeout/`AbortController` is added anywhere (`spec.md` scenario 2 — explicitly rejected).
- No phone-format regex is added client-side (`spec.md` scenario 1 — explicitly decided against, stay server-enforced).
- Every UI string stays Hebrew/RTL, matching the existing file's voice.
- After every task, before starting the next: dispatch a fresh-context Codex review of that task's diff (see "Execution note" at the end) — this is an execution-process requirement, not a plan step, so it isn't numbered as its own task below.

---

## File Structure

- **Create:** `vitest.config.ts` — test runner config (jsdom environment, React plugin).
- **Create:** `vitest.setup.ts` — loads `@testing-library/jest-dom/vitest` matchers globally.
- **Create:** `app/join/__tests__/test-utils.tsx` — shared fetch-mocking + render helper, used by all four test files below. One place to change if the mock shape ever needs to change.
- **Create:** `app/join/__tests__/SignupForm.city.test.tsx` — Task 1.
- **Create:** `app/join/__tests__/SignupForm.name-validation.test.tsx` — Task 2.
- **Create:** `app/join/__tests__/SignupForm.maxlength.test.tsx` — Task 3.
- **Create:** `app/join/__tests__/SignupForm.submission-id.test.tsx` — Task 4.
- **Modify:** `app/join/SignupForm.tsx` — all four behavioral tasks land here.
- **Modify:** `package.json` — new `devDependencies` and a `test` script (Task 0).

---

### Task 0: Add Vitest + React Testing Library

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `app/join/__tests__/test-utils.tsx`
- Create: `app/join/__tests__/SignupForm.smoke.test.tsx` (proves the setup works; deleted by no later task — it stays as a real regression test)

**Interfaces:**
- Consumes: nothing
- Produces: `npm run test` (runs `vitest run`); `renderFormReady()`, `installFetchMock()`, `jsonResponse()` exported from `app/join/__tests__/test-utils.tsx`, imported by every later task's test file — these three names and signatures are load-bearing for Tasks 1-4, keep them exact.

- [ ] **Step 1: Install dependencies**

```bash
npm install --save-dev vitest@4.1.11 @vitejs/plugin-react@6.1.1 jsdom@30.0.1 @testing-library/react@16.3.3 @testing-library/jest-dom@7.0.1 @testing-library/user-event@14.6.6
```

- [ ] **Step 2: Add the `test` script**

In `package.json`, add to `"scripts"` (alongside the existing `dev`/`build`/`start`/`lint`):

```json
"test": "vitest run"
```

- [ ] **Step 3: Create the Vitest config**

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

`vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Create the shared test helper**

`app/join/__tests__/test-utils.tsx`:

```tsx
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
```

- [ ] **Step 5: Write the smoke test**

`app/join/__tests__/SignupForm.smoke.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderFormReady } from "./test-utils";

describe("SignupForm smoke test", () => {
  it("renders the form once the link and cities checks resolve", async () => {
    await renderFormReady();
    expect(screen.getByLabelText("שם מלא")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run it, confirm it fails for the right reason first**

This step exists to prove the harness actually exercises real code, not to
find a pre-existing bug. Temporarily rename `app/join/SignupForm.tsx`'s
export (e.g. `SignupForm` → `SignupFormX`) — don't do this, instead just
run the test now, before any of Tasks 1-4 touch the component, as the
baseline:

```bash
npm run test
```

Expected: **PASS**. `SignupForm.tsx` already has a `שם מלא` label — this
test isn't red-then-green on its own (there's no bug it's proving), it
exists purely to prove the harness (jsdom, RTL, the fetch mock, the
`waitFor`) works end-to-end before Tasks 1-4 build on it. If this fails,
stop and fix the harness before continuing — nothing in Tasks 1-4 can be
trusted otherwise.

- [ ] **Step 7: Verify lint/build still pass with the new devDependencies**

```bash
npm run lint
npm run build
```

Expected: both exit 0.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts app/join/__tests__/test-utils.tsx app/join/__tests__/SignupForm.smoke.test.tsx
git commit -m "$(cat <<'EOF'
chore(test): add Vitest + React Testing Library

No test framework existed in this repo. Adds Vitest 4, jsdom, and RTL 16
(React 19-compatible), a shared fetch-mocking render helper for
SignupForm, and a smoke test proving the harness works end-to-end. Later
commits build real red-then-green tests on top of this.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1: City field — optional end-to-end (wire contract + selectable/relabeled blank option + optional label)

**Files:**
- Create: `app/join/__tests__/SignupForm.city.test.tsx`
- Modify: `app/join/SignupForm.tsx:140-160` (the city field block) and `:59-66` (submit body construction)

**Interfaces:**
- Consumes: `renderFormReady`, `installFetchMock`, `submittedBody` from `app/join/__tests__/test-utils.tsx` (Task 0)
- Produces: nothing new for later tasks — this task's JSX/body changes are read, not called, by Task 4 (which lands its own changes in the same function later)

- [ ] **Step 1: Write the failing tests**

`app/join/__tests__/SignupForm.city.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderFormReady, submittedBody } from "./test-utils";

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/שם מלא/), "ישראל ישראלי");
  await user.type(screen.getByLabelText(/טלפון נייד/), "0501234567");
}

describe("SignupForm city field", () => {
  it("does not mark the city select as required", async () => {
    await renderFormReady();
    expect(screen.getByLabelText(/עיר/)).not.toBeRequired();
  });

  it("labels the field as optional", async () => {
    await renderFormReady();
    expect(screen.getByText("עיר (לא חובה)")).toBeInTheDocument();
  });

  it("offers a selectable, real 'no city' option instead of a disabled placeholder", async () => {
    await renderFormReady();
    const blankOption = screen.getByRole("option", { name: "ללא ציון עיר" });
    expect(blankOption).not.toBeDisabled();
  });

  it("omits cityId from the request body when left blank", async () => {
    const user = userEvent.setup();
    const fetchMock = await renderFormReady();
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));
    const body = submittedBody(fetchMock);
    expect(body).not.toHaveProperty("cityId");
  });

  it("sends cityId when a city is selected", async () => {
    const user = userEvent.setup();
    const fetchMock = await renderFormReady();
    await fillRequiredFields(user);
    await user.selectOptions(screen.getByLabelText(/עיר/), "city-1");
    await user.click(screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));
    const body = submittedBody(fetchMock);
    expect(body.cityId).toBe("city-1");
  });

  it("lets the supporter pick a city and then return to 'no city'", async () => {
    const user = userEvent.setup();
    await renderFormReady();
    const select = screen.getByLabelText<HTMLSelectElement>(/עיר/);
    await user.selectOptions(select, "city-1");
    expect(select.value).toBe("city-1");
    await user.selectOptions(select, "");
    expect(select.value).toBe("");
  });
});
```

- [ ] **Step 2: Run the tests, confirm they fail**

```bash
npm run test -- SignupForm.city
```

Expected: **FAIL** — the `required` check fails (select still has
`required`), the "(לא חובה)" label text doesn't exist yet, the blank
option is `disabled` so the "not disabled" assertion fails, and the
`cityId` body assertions fail because today's code always sends
`cityId: ""`.

- [ ] **Step 3: Implement the minimal fix**

Replace the city field block in `app/join/SignupForm.tsx` (currently lines
140-160):

```tsx
<div className={styles.field}>
  <label className="text-label" htmlFor="city">
    עיר (לא חובה)
  </label>
  <select
    id="city"
    className={styles.select}
    value={cityId}
    onChange={(event) => setCityId(event.target.value)}
  >
    <option value="">ללא ציון עיר</option>
    {cities.map((city) => (
      <option key={city.id} value={city.id}>
        {city.name}
      </option>
    ))}
  </select>
</div>
```

And the submit body construction (currently lines 59-66, inside
`handleSubmit`'s `fetch` call):

```tsx
body: JSON.stringify({
  fullName,
  phone,
  ...(cityId ? { cityId } : {}),
  linkCode,
  clientSubmissionId: crypto.randomUUID(),
  honeypot,
}),
```

(`clientSubmissionId: crypto.randomUUID()` stays exactly as it was for
this task — Task 4 replaces it. Leave it alone here so this task's diff
stays scoped to the city field.)

- [ ] **Step 4: Run the tests, confirm they pass**

```bash
npm run test -- SignupForm.city
```

Expected: **PASS**, all 6 tests.

- [ ] **Step 5: Run the full suite + lint/build**

```bash
npm run test
npm run lint
npm run build
```

Expected: all exit 0 (the Task 0 smoke test must still pass too).

- [ ] **Step 6: Commit**

```bash
git add app/join/SignupForm.tsx app/join/__tests__/SignupForm.city.test.tsx
git commit -m "$(cat <<'EOF'
fix(join): make city field genuinely optional on wire and in UI

- Remove `required` from the city select.
- Omit the `cityId` key from the signup request body when blank, instead
  of sending an empty string (which would fail the server's min-length
  check and reject the whole submission).
- Make the blank option selectable (was `disabled`, permanently locking
  in a choice once made) and relabel it "ללא ציון עיר" so it reads as a
  real choice, not a stale placeholder.
- Add an explicit "(לא חובה)" marker to the field label.

Implements docs/features/join-form/spec.md "City handling".

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Name field — trim and locally validate before any network call

**Files:**
- Create: `app/join/__tests__/SignupForm.name-validation.test.tsx`
- Modify: `app/join/SignupForm.tsx:50-53` (start of `handleSubmit`) and the `fullName` line inside the body from Task 1

**Interfaces:**
- Consumes: `renderFormReady`, `submittedBody` from `test-utils.tsx`
- Produces: nothing new for later tasks. Land after Task 1 so this task's diff to `handleSubmit` sits right after Task 1's, not conflicting with it.

- [ ] **Step 1: Write the failing tests**

`app/join/__tests__/SignupForm.name-validation.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderFormReady, submittedBody } from "./test-utils";

describe("SignupForm name validation", () => {
  it("blocks submission and shows an inline error for a whitespace-only name", async () => {
    const user = userEvent.setup();
    const fetchMock = await renderFormReady();
    await user.type(screen.getByLabelText(/שם מלא/), "   ");
    await user.type(screen.getByLabelText(/טלפון נייד/), "0501234567");
    await user.click(screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));

    expect(await screen.findByText("אנא הזן שם מלא")).toBeInTheDocument();
    const signupCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/api/proxy/support-signup")
    );
    expect(signupCalls).toHaveLength(0);
  });

  it("sends the trimmed name on a successful submit", async () => {
    const user = userEvent.setup();
    const fetchMock = await renderFormReady();
    await user.type(screen.getByLabelText(/שם מלא/), "  ישראל ישראלי  ");
    await user.type(screen.getByLabelText(/טלפון נייד/), "0501234567");
    await user.click(screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));

    await vi.waitFor(() => {
      const body = submittedBody(fetchMock);
      expect(body.fullName).toBe("ישראל ישראלי");
    });
  });
});
```

- [ ] **Step 2: Run the tests, confirm they fail**

```bash
npm run test -- SignupForm.name-validation
```

Expected: **FAIL** — no inline "אנא הזן שם מלא" error exists yet (a
whitespace-only name passes straight through to `fetch` today), and the
submitted `fullName` is the untrimmed `"  ישראל ישראלי  "`.

- [ ] **Step 3: Implement the minimal fix**

At the top of `handleSubmit` (currently lines 50-53):

```tsx
async function handleSubmit(event: React.FormEvent) {
  event.preventDefault();
  setError(null);

  const trimmedName = fullName.trim();
  if (!trimmedName) {
    setError("אנא הזן שם מלא");
    return;
  }

  setStep("submitting");

  try {
```

And change the body's `fullName` field (inside the same `fetch` call
Task 1 already touched) to send the trimmed value:

```tsx
body: JSON.stringify({
  fullName: trimmedName,
  phone,
  ...(cityId ? { cityId } : {}),
  linkCode,
  clientSubmissionId: crypto.randomUUID(),
  honeypot,
}),
```

- [ ] **Step 4: Run the tests, confirm they pass**

```bash
npm run test -- SignupForm.name-validation
```

Expected: **PASS**, both tests.

- [ ] **Step 5: Run the full suite + lint/build**

```bash
npm run test
npm run lint
npm run build
```

Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/join/SignupForm.tsx app/join/__tests__/SignupForm.name-validation.test.tsx
git commit -m "$(cat <<'EOF'
fix(join): trim and locally validate name before submitting

Whitespace-only input passed the browser's native required check and
reached the network layer, surfacing as a confusing generic round-trip
error instead of a clear local one. Trim fullName and block submission
with a specific inline error if the trimmed result is empty, before any
fetch call. The trimmed value is what's actually sent on success.

Implements docs/features/join-form/spec.md scenario 4.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Name/phone input length parity with the server schema

**Files:**
- Create: `app/join/__tests__/SignupForm.maxlength.test.tsx`
- Modify: `app/join/SignupForm.tsx:115-122` (name `<input>`) and `:129-137` (phone `<input>`)

**Interfaces:**
- Consumes: `renderFormReady` from `test-utils.tsx`
- Produces: nothing new. Independent of Tasks 1/2/4 — no shared lines, safe to land in any order relative to them.

- [ ] **Step 1: Write the failing tests**

`app/join/__tests__/SignupForm.maxlength.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderFormReady } from "./test-utils";

describe("SignupForm input length limits", () => {
  it("caps the name input at 200 characters, matching the server schema", async () => {
    await renderFormReady();
    expect(screen.getByLabelText<HTMLInputElement>(/שם מלא/)).toHaveAttribute(
      "maxLength",
      "200"
    );
  });

  it("caps the phone input at 30 characters, matching the server schema", async () => {
    await renderFormReady();
    expect(screen.getByLabelText<HTMLInputElement>(/טלפון נייד/)).toHaveAttribute(
      "maxLength",
      "30"
    );
  });
});
```

- [ ] **Step 2: Run the tests, confirm they fail**

```bash
npm run test -- SignupForm.maxlength
```

Expected: **FAIL** — neither input has a `maxLength` attribute today.

- [ ] **Step 3: Implement the minimal fix**

Add `maxLength={200}` to the name input (currently lines 115-122):

```tsx
<input
  id="fullName"
  className={styles.input}
  type="text"
  required
  maxLength={200}
  value={fullName}
  onChange={(event) => setFullName(event.target.value)}
/>
```

Add `maxLength={30}` to the phone input (currently lines 129-137):

```tsx
<input
  id="phone"
  className={styles.input}
  type="tel"
  inputMode="numeric"
  required
  maxLength={30}
  value={phone}
  onChange={(event) => setPhone(event.target.value)}
/>
```

- [ ] **Step 4: Run the tests, confirm they pass**

```bash
npm run test -- SignupForm.maxlength
```

Expected: **PASS**, both tests.

- [ ] **Step 5: Run the full suite + lint/build**

```bash
npm run test
npm run lint
npm run build
```

Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/join/SignupForm.tsx app/join/__tests__/SignupForm.maxlength.test.tsx
git commit -m "$(cat <<'EOF'
fix(join): add client-side maxLength matching server schema bounds

Name/phone had no client-side length limit, so an over-limit value was
only rejected after a round trip. maxLength=200/30 mirrors the server's
Zod schema exactly.

Implements docs/features/join-form/spec.md scenario 9.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `clientSubmissionId` lifecycle — safe retry without a conflict trap

**Files:**
- Create: `app/join/__tests__/SignupForm.submission-id.test.tsx`
- Modify: `app/join/SignupForm.tsx:1-17` (imports/state), `:50-80` (`handleSubmit`, on top of Tasks 1 and 2's changes), and the three field `onChange` handlers (name, phone, city)

**Interfaces:**
- Consumes: `useRef` (new import from `"react"`), `renderFormReady`, `submittedBody` from `test-utils.tsx`, and builds on `handleSubmit` as left by Tasks 1 and 2 — land this task last.
- Produces: a `submissionId` state value and an `invalidateSubmissionIdIfNeeded()` function, both local to this component — no other file depends on these names.

- [ ] **Step 1: Write the failing tests**

`app/join/__tests__/SignupForm.submission-id.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { jsonResponse, renderFormReady, submittedBody } from "./test-utils";

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));
}

describe("SignupForm clientSubmissionId lifecycle", () => {
  it("reuses the same id across a retry after an ambiguous (network) failure with an unchanged payload", async () => {
    const user = userEvent.setup();
    let call = 0;
    const fetchMock = await renderFormReady({
      signup: () => {
        call += 1;
        if (call === 1) return Promise.reject(new Error("network down"));
        return Promise.resolve(jsonResponse({ status: "success" }));
      },
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
    const fetchMock = await renderFormReady({
      signup: () => {
        call += 1;
        if (call === 1) return Promise.resolve(jsonResponse({ status: "error" }, 400));
        return Promise.resolve(jsonResponse({ status: "success" }));
      },
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
    const fetchMock = await renderFormReady({
      signup: () => Promise.reject(new Error("network down")),
    });
    await user.type(screen.getByLabelText(/שם מלא/), "ישראל ישראלי");
    await user.type(screen.getByLabelText(/טלפון נייד/), "0501234567");
    await fillAndSubmit(user);
    await screen.findByText("אירעה שגיאה. נסו שוב בעוד רגע.");

    await user.type(screen.getByLabelText(/שם מלא/), "י");

    const firstBody = submittedBody(fetchMock, 0);
    // second attempt will also reject (mock always rejects here) — that's
    // fine, this test only checks the id minted for the *next* attempt
    // differs after the edit, regardless of that attempt's own outcome.
    await fillAndSubmit(user).catch(() => {});
    await vi.waitFor(() => {
      const secondBody = submittedBody(fetchMock, 1);
      expect(secondBody.clientSubmissionId).not.toBe(firstBody.clientSubmissionId);
    });
  });
});
```

- [ ] **Step 2: Run the tests, confirm they fail**

```bash
npm run test -- SignupForm.submission-id
```

Expected: **FAIL** on all three — today's code calls
`crypto.randomUUID()` fresh inside every `handleSubmit` invocation, so the
first test's "same id" assertion fails (ids always differ), and the
second/third tests' "different id" assertions happen to pass by accident
today (ids are always different) but for the wrong reason — re-read Step
4 below once the real implementation lands, since a test passing before
its fix exists for the right reason is itself a signal to double check.
For this task specifically, confirm test 1 fails now (that's the one that
can't pass by accident); tests 2 and 3 are expected to already pass at
this point precisely because the current code has no reuse logic at all —
note this in the PR context, then proceed, since Step 4 will verify all
three together against the *real* implementation regardless.

- [ ] **Step 3: Implement the minimal fix**

Update the imports at the top of `app/join/SignupForm.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./SignupForm.module.css";
```

Add state and the ref-backed invalidation helper alongside the existing
state declarations:

```tsx
export function SignupForm({ linkCode }: { linkCode: string }) {
  const [step, setStep] = useState<Step>("loading");
  const [cities, setCities] = useState<City[]>([]);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cityId, setCityId] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());
  const ambiguousFailurePendingRef = useRef(false);

  function invalidateSubmissionIdIfNeeded() {
    if (ambiguousFailurePendingRef.current) {
      ambiguousFailurePendingRef.current = false;
      setSubmissionId(crypto.randomUUID());
    }
  }
```

Update `handleSubmit` (now including Task 1 and Task 2's changes) to use
`submissionId` and apply the fresh-vs-reuse rule:

```tsx
async function handleSubmit(event: React.FormEvent) {
  event.preventDefault();
  setError(null);

  const trimmedName = fullName.trim();
  if (!trimmedName) {
    setError("אנא הזן שם מלא");
    return;
  }

  setStep("submitting");

  try {
    const response = await fetch("/api/proxy/support-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: trimmedName,
        phone,
        ...(cityId ? { cityId } : {}),
        linkCode,
        clientSubmissionId: submissionId,
        honeypot,
      }),
    });

    if (!response.ok) {
      ambiguousFailurePendingRef.current = false;
      setSubmissionId(crypto.randomUUID());
      setError("אירעה שגיאה. נסו שוב בעוד רגע.");
      setStep("form");
      return;
    }

    setStep("done");
  } catch {
    ambiguousFailurePendingRef.current = true;
    setError("אירעה שגיאה. נסו שוב בעוד רגע.");
    setStep("form");
  }
}
```

Wire `invalidateSubmissionIdIfNeeded()` into each of the three relevant
fields' `onChange` handlers:

```tsx
// name input
onChange={(event) => {
  invalidateSubmissionIdIfNeeded();
  setFullName(event.target.value);
}}

// phone input
onChange={(event) => {
  invalidateSubmissionIdIfNeeded();
  setPhone(event.target.value);
}}

// city select
onChange={(event) => {
  invalidateSubmissionIdIfNeeded();
  setCityId(event.target.value);
}}
```

- [ ] **Step 4: Run the tests, confirm they pass**

```bash
npm run test -- SignupForm.submission-id
```

Expected: **PASS**, all three — and now for the right reason (verify by
reading the implementation, not just the green checkmark, per Step 2's
note).

- [ ] **Step 5: Run the full suite + lint/build**

```bash
npm run test
npm run lint
npm run build
```

Expected: all exit 0 — this is the final task, so this is the full green
suite across all of Tasks 0-4.

- [ ] **Step 6: Commit**

```bash
git add app/join/SignupForm.tsx app/join/__tests__/SignupForm.submission-id.test.tsx
git commit -m "$(cat <<'EOF'
fix(join): safe clientSubmissionId lifecycle across retries

clientSubmissionId was regenerated on every handleSubmit call, so a retry
after a network timeout (server may have already written the row, client
never saw the response) sent a fresh idempotency key and risked creating
a duplicate Voter.

Fix: generate the id once per mount and reuse it across a retry that
follows an ambiguous failure (fetch threw, no response) with an unchanged
payload. Any definitive server response, or any field edit after a failed
attempt, mints a fresh id instead — otherwise correcting a field (e.g. a
bad phone number) and resubmitting would permanently collide with the
first attempt's id.

Implements docs/features/join-form/spec.md scenario 2.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Execution note: Codex review per task

After each task's Step 6 (commit) and before starting the next task,
dispatch a fresh-context Codex review of that task's diff specifically
(`git diff HEAD~1` at that point, or the equivalent named commit) —
same pattern as the earlier spec review: scoped strictly to
`coorporationLanding`, explicitly told not to read/reference the
`corporations` repo, asked to check the new test's assertions actually
match the spec decision it claims to implement and that the implementation
doesn't just make the test pass by coincidence. This is a per-task gate in
the subagent-driven-development flow, not a plan step — mention it to
whichever subagent orchestrates Task N+1 as a precondition.

## Self-Review

**Spec coverage:** `spec.md`'s "City handling" → Task 1. Scenario 1 (phone
format) → intentionally no task, per spec's own decision to stay
server-enforced. Scenario 2 (idempotency) → Task 4. Scenario 3 (invalid
link vs. transient failure) → intentionally no task, decided as
already-correct behavior. Scenario 4 (whitespace name) → Task 2. Scenario
5 (stale doc cross-reference) → already fixed separately (not app code).
Scenario 6 (city list failure) → intentionally no task, decided as
already-correct now that city is optional (Task 1). Scenario 7 (generic
submit errors) → intentionally no task, decided as intentional. Scenario 8
(HTTP-status-only success) → intentionally no task, decided as
intentional. Scenario 9 (length parity) → Task 3. Test framework itself →
Task 0. Every scenario is accounted for, whether by a task or an explicit
"no change needed" decision already recorded in the spec itself.

**Placeholder scan:** no TBD/TODO; every step has real, complete code
(implementation and test code both), not a description of code.

**Type consistency:** `submissionId`/`setSubmissionId` (Task 4) match
exactly wherever referenced. `invalidateSubmissionIdIfNeeded` — defined
once (Task 4 Step 3), called identically (no args) from all three field
handlers in the same step. `trimmedName` (Task 2) is consumed by both Task
2's early-return and Task 4's final `handleSubmit` body — same name, same
meaning. `renderFormReady`/`installFetchMock`/`jsonResponse`/
`submittedBody` (Task 0) are imported with identical names and call
signatures across all four test files (Tasks 1-4) — verified by reading
each test file's import line above.
