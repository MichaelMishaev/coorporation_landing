# Standalone Signup Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `coorporationLanding` fully standalone — its own Postgres,
its own signup-storage/validation/rate-limiting logic, zero runtime
dependency on the `corporations` repo/service — replacing the current
proxy-to-`corporations` architecture end to end.

**Architecture:** New Prisma-backed Postgres (dev instance provisioned on
Railway as part of this plan) holding two tables (`SupportSignup`,
`SignupRateLimitBucket`). A new `/api/signup` route implements the exact
three-step idempotency-then-rate-limit-then-write sequence from the spec,
built as its own testable module first, then wrapped by the route. The
old `/api/proxy/*` routes, `lib/proxy.ts`, and the link-code concept in
`SignupForm.tsx` are deleted. The existing Vitest suite (from an earlier
plan) is rewritten to match.

**Tech Stack:** Next.js (App Router), Prisma 7.10.0 + `@prisma/client`
7.10.0, Postgres (new Railway service), Vitest + React Testing Library
(already set up).

**Spec:** `docs/features/standalone-signup/spec.md` — acceptance criteria
in `docs/features/standalone-signup/expected-result.md`. Both are settled
(two independent adversarial review rounds each, all findings fixed) —
implement as written, don't re-litigate.

## Global Constraints

- **This plan NEVER touches the `corporations` repo at
  `/Users/michaelmishayev/Desktop/Projects/corporations` — not even
  read-only.** A separate document, `docs/for-corporations-ai.md`, covers
  what (if anything) happens on that side; it is out of scope here and for
  whoever executes this plan.
- No personal/recruiter links, no `SupportLink` table, no link-code concept
  anywhere — one static `/join` form (spec.md "Scope cut for v1").
- Every UI string stays Hebrew/RTL, matching the existing file's voice.
- `fullName`/`phone`/`cityName` validation, `maxLength` values (200/30/100),
  and the `clientSubmissionId` generation/rotation rules
  (`docs/features/join-form/spec.md` scenario 2, already correctly
  implemented on `develop`) carry forward unchanged — this plan adapts
  their wire contract and server-side handling, not their logic.
- Rate limiting is Postgres-backed only — no new Redis service.
- Dev and prod get separate Postgres **instances**, never a shared
  instance with separate logical databases (spec.md "Infrastructure").
- Any Railway action that creates a billed resource requires explicit
  user confirmation immediately before creating it — not just a comment
  saying so.

---

## File Structure

- **Create:** `prisma/schema.prisma` — the two-table schema.
- **Create:** `lib/cities.ts` — static city list.
- **Create:** `lib/signup/submit-signup.ts` — the core write-path logic
  module (idempotency, rate limit, write), framework-agnostic (no Next.js
  imports), testable on its own.
- **Create:** `lib/signup/__tests__/submit-signup.test.ts` — integration
  tests against the real dev Postgres.
- **Create:** `app/api/signup/route.ts` — the HTTP route, thin wrapper
  around `submit-signup.ts` plus request parsing/validation/IP extraction.
- **Create:** `app/api/signup/__tests__/route.test.ts` — route-level tests.
- **Modify:** `app/join/SignupForm.tsx` — drop `linkCode` prop, the
  link-check `useEffect`, `loading`/`inactive` states; new request body
  and endpoint.
- **Modify:** `app/join/page.tsx` — render `SignupForm` directly, no code
  logic.
- **Delete:** `app/join/[code]/` (entire directory).
- **Delete:** `lib/proxy.ts`, `app/api/proxy/` (entire directory, all four
  routes).
- **Modify:** `app/join/__tests__/test-utils.tsx` — new single-endpoint
  mock shape.
- **Modify:** all five files under `app/join/__tests__/` to match the
  rewritten component.
- **Modify:** `.env.example` — remove the three old env vars, document
  `DATABASE_URL`.

---

### Task 1: Provision dev Postgres + wire Prisma

**Files:**
- Create: `prisma/schema.prisma` (minimal, just the datasource/generator
  blocks — the real models are Task 2)
- Modify: `package.json` (new dependencies)
- Modify: `.env.local` (new `DATABASE_URL`, not committed — this file is
  gitignored)
- Modify: `.env.example` (document the new var, remove the three old ones)

**Interfaces:**
- Consumes: nothing
- Produces: a working `DATABASE_URL` in `.env.local` that Task 2's
  migration and Task 4's tests connect to; `prisma/schema.prisma` with the
  `datasource`/`generator` blocks Task 2 adds models into.

- [ ] **Step 1: Get explicit user confirmation before creating anything on Railway**

Stop here and ask the user to confirm: "About to provision a new Postgres
service on Railway, in project `rbac_proj` (id
`812ee13e-900b-4435-9b08-6a6f96060771`), development environment (id
`5cd4f804-81b1-4ce7-ba4d-15980898dbe7`), named e.g.
`coorporation-landing-postgres-dev` — this is a real, billed resource.
Proceed?" Do not create it without an explicit yes. This step cannot be
skipped or assumed.

- [ ] **Step 2: Provision the Postgres service**

Use the Railway MCP tools (load their schemas via `ToolSearch` with query
`"select:mcp__railway__deploy_template,mcp__railway__create_service,mcp__railway__list_variables,mcp__railway__docs_search"`
if not already loaded). Deploy a Postgres instance into project
`812ee13e-900b-4435-9b08-6a6f96060771`, environment
`5cd4f804-81b1-4ce7-ba4d-15980898dbe7`, named distinctly from
`corporations`' existing `Postgres`/`Postgres-coes` services in that same
project (e.g. `coorporation-landing-postgres-dev`) — check
`mcp__railway__list_services` first to confirm the name doesn't collide.
If the exact provisioning tool/flow isn't obvious from the loaded tool
schemas, use `mcp__railway__docs_search` for "provision postgres" before
guessing at a tool call.

- [ ] **Step 3: Retrieve the connection string**

Once created, use `mcp__railway__list_variables` on the new Postgres
service to get its `DATABASE_URL` (or `DATABASE_PUBLIC_URL` if that's
what's exposed for external/local connections — Railway Postgres services
typically expose both an internal and a public connection string; local
development needs the public one).

- [ ] **Step 4: Write `DATABASE_URL` to `.env.local`**

```bash
echo "DATABASE_URL=<the public connection string from Step 3>" >> .env.local
```

(`.env.local` is already gitignored in this repo — confirm with `git
check-ignore .env.local` before proceeding if unsure.)

- [ ] **Step 5: Install Prisma**

```bash
npm install --save-dev prisma@7.10.0
npm install @prisma/client@7.10.0
```

- [ ] **Step 6: Initialize the schema file**

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

- [ ] **Step 7: Verify the connection**

```bash
npx prisma db pull
```

Expected: connects successfully and reports an empty schema (no tables
yet) — confirms `DATABASE_URL` is correct and reachable, before Task 2
adds real models. If this fails, stop and fix the connection string
before continuing — nothing in Task 2+ can be trusted otherwise.

- [ ] **Step 8: Update `.env.example`**

Remove the `MANAGEMENT_APP_BASE_URL`, `PUBLIC_PROXY_SECRET`, and
`NEXT_PUBLIC_GENERIC_JOIN_CODE` blocks entirely (Task 6 deletes the code
that reads them). Add:

```
# Postgres connection string for this app's own standalone database.
# See docs/features/standalone-signup/spec.md "Infrastructure" — this is
# a dedicated instance for this app, never shared with corporations' or
# with the other environment's (dev/prod) database.
DATABASE_URL=
```

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json prisma/schema.prisma .env.example
git commit -m "$(cat <<'EOF'
chore: add Prisma, provision dev Postgres for standalone signup backend

New dedicated Postgres service (Railway, rbac_proj, development
environment) for this app's own signup storage — no data-sharing with
corporations' Postgres. DATABASE_URL wired locally via .env.local
(gitignored, not committed). Schema is empty pending Task 2's models.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

(`.env.local` itself is never committed — confirm it's not staged.)

---

### Task 2: `SupportSignup` and `SignupRateLimitBucket` schema + migration

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: the `DATABASE_URL` from Task 1
- Produces: `SupportSignup` and `SignupRateLimitBucket` Prisma models —
  Task 4's module and its tests import the generated `PrismaClient` and
  use these exact model/field names.

- [ ] **Step 1: Write the schema**

`prisma/schema.prisma` (full file):

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model SupportSignup {
  id                 String   @id @default(uuid())
  fullName           String   @db.VarChar(200)
  phone              String   @db.VarChar(30)
  cityName           String?  @db.VarChar(100)
  clientSubmissionId String   @unique
  payloadDigest      String
  ip                 String
  honeypotTripped    Boolean  @default(false)
  createdAt          DateTime @default(now())

  @@map("support_signups")
}

model SignupRateLimitBucket {
  ip          String
  windowStart DateTime
  count       Int      @default(0)

  @@unique([ip, windowStart], name: "ip_windowStart")
  @@map("signup_rate_limit_buckets")
}
```

This matches `docs/features/standalone-signup/spec.md`'s "Data model" and
"`SignupRateLimitBucket`" sections field-for-field (types, `VarChar`
lengths, nullability, uniqueness).

- [ ] **Step 2: Generate and apply the migration**

```bash
npx prisma migrate dev --name init_standalone_signup
```

Expected: creates `prisma/migrations/<timestamp>_init_standalone_signup/`,
applies it to the dev Postgres from Task 1, and regenerates the Prisma
Client.

- [ ] **Step 3: Verify the tables exist**

```bash
npx prisma db pull --print
```

Expected output includes both `SupportSignup` and `SignupRateLimitBucket`
matching what was just written (confirms the migration actually applied,
not just that the local schema file looks right).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "$(cat <<'EOF'
feat(db): add SupportSignup and SignupRateLimitBucket models

Two-table schema for the standalone signup backend, per
docs/features/standalone-signup/spec.md's "Data model" and
"SignupRateLimitBucket" sections. No SupportLink or User table — matches
the v1 scope cut (no personal links, no corporations dependency).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Static city list

**Files:**
- Create: `lib/cities.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `CITIES: readonly string[]` — imported by `SignupForm.tsx`
  (Task 7) for the `<select>` options.

- [ ] **Step 1: Write the list**

`lib/cities.ts`:

```ts
/**
 * Static city list for the standalone signup form. Not a DB table, not
 * fetched over the network — per docs/features/standalone-signup/spec.md
 * "City list": nothing about this list needs to be admin-editable or
 * queried, it's a fixed set of Israeli city names for a single-client
 * campaign app. Exact contents are an implementation-time choice per that
 * same section — this is a reasonable starting list of major population
 * centers, not an exhaustive one; growing it later is a one-line change.
 */
export const CITIES = [
  "תל אביב-יפו",
  "ירושלים",
  "חיפה",
  "ראשון לציון",
  "פתח תקווה",
  "אשדוד",
  "נתניה",
  "באר שבע",
  "בני ברק",
  "חולון",
  "רמת גן",
  "אשקלון",
  "רחובות",
  "בת ים",
  "כפר סבא",
  "הרצליה",
  "חדרה",
  "מודיעין-מכבים-רעות",
  "נצרת",
  "לוד",
] as const;
```

No test needed — this is static data with no logic; Task 7's component
tests exercise it indirectly (selecting an option from the list).

- [ ] **Step 2: Commit**

```bash
git add lib/cities.ts
git commit -m "$(cat <<'EOF'
feat: add static city list for standalone signup form

Replaces the /api/proxy/cities network round-trip — no route, no fetch,
per docs/features/standalone-signup/spec.md "City list".

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Core write-path logic — `submitSignup()`

**Files:**
- Create: `lib/signup/submit-signup.ts`
- Test: `lib/signup/__tests__/submit-signup.test.ts` (integration tests
  against the real dev Postgres from Task 1/2 — this is deliberately not
  mocked; the spec's two Critical-severity bugs were both caught exactly
  here, in real database behavior a mock would have hidden)

**Interfaces:**
- Consumes: `PrismaClient` (from `@prisma/client`, generated in Task 2)
- Produces: `submitSignup(prisma: PrismaClient, input: SubmitSignupInput): Promise<SubmitSignupResult>`,
  `SubmitSignupInput` (`{ fullName, phone, cityName, clientSubmissionId, ip, honeypotTripped }`),
  `SubmitSignupResult` (`{ type: "success" } | { type: "conflict" } | { type: "rateLimited" }`)
  — Task 5's route imports and calls this directly, matching these exact
  names and shapes.

- [ ] **Step 1: Write the failing tests**

`lib/signup/__tests__/submit-signup.test.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { submitSignup, type SubmitSignupInput } from "../submit-signup";

const prisma = new PrismaClient();

beforeAll(async () => {
  await prisma.$connect();
});

afterEach(async () => {
  await prisma.supportSignup.deleteMany();
  await prisma.signupRateLimitBucket.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function baseInput(overrides: Partial<SubmitSignupInput> = {}): SubmitSignupInput {
  return {
    fullName: "ישראל ישראלי",
    phone: "0501234567",
    cityName: "תל אביב-יפו",
    clientSubmissionId: crypto.randomUUID(),
    ip: "1.2.3.4",
    honeypotTripped: false,
    ...overrides,
  };
}

describe("submitSignup", () => {
  it("creates a new row on a fresh submission", async () => {
    const input = baseInput();
    const result = await submitSignup(prisma, input);
    expect(result).toEqual({ type: "success" });

    const rows = await prisma.supportSignup.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].clientSubmissionId).toBe(input.clientSubmissionId);
  });

  it("returns success without creating a second row on an exact replay", async () => {
    const input = baseInput();
    await submitSignup(prisma, input);
    const second = await submitSignup(prisma, input);
    expect(second).toEqual({ type: "success" });

    const rows = await prisma.supportSignup.findMany();
    expect(rows).toHaveLength(1);
  });

  it("returns conflict, not the original data, when the same id is reused with a different payload", async () => {
    const id = crypto.randomUUID();
    await submitSignup(prisma, baseInput({ clientSubmissionId: id, fullName: "ישראל ישראלי" }));
    const second = await submitSignup(prisma, baseInput({ clientSubmissionId: id, fullName: "דנה כהן" }));
    expect(second).toEqual({ type: "conflict" });

    const rows = await prisma.supportSignup.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].fullName).toBe("ישראל ישראלי");
  });

  it("rejects once the rate limit threshold is hit and creates zero rows for the rejected attempt", async () => {
    const ip = "9.9.9.9";
    for (let i = 0; i < 5; i++) {
      const result = await submitSignup(prisma, baseInput({ ip, clientSubmissionId: crypto.randomUUID() }));
      expect(result).toEqual({ type: "success" });
    }
    const sixth = await submitSignup(prisma, baseInput({ ip, clientSubmissionId: crypto.randomUUID() }));
    expect(sixth).toEqual({ type: "rateLimited" });

    const rows = await prisma.supportSignup.findMany({ where: { ip } });
    expect(rows).toHaveLength(5);
  });

  it("does not exceed the rate limit cap under concurrent requests from the same IP", async () => {
    const ip = "8.8.8.8";
    const attempts = Array.from({ length: 8 }, () =>
      submitSignup(prisma, baseInput({ ip, clientSubmissionId: crypto.randomUUID() }))
    );
    const results = await Promise.all(attempts);
    const successCount = results.filter((r) => r.type === "success").length;
    expect(successCount).toBeLessThanOrEqual(5);

    const rows = await prisma.supportSignup.findMany({ where: { ip } });
    expect(rows).toHaveLength(successCount);
  });
});
```

- [ ] **Step 2: Run the tests, confirm they fail**

```bash
npm run test -- submit-signup
```

Expected: **FAIL** — `../submit-signup` doesn't exist yet.

- [ ] **Step 3: Implement**

`lib/signup/submit-signup.ts`:

```ts
import { createHash } from "crypto";
import { Prisma, type PrismaClient } from "@prisma/client";

export type SubmitSignupInput = {
  fullName: string;
  phone: string;
  cityName: string | null;
  clientSubmissionId: string;
  ip: string;
  honeypotTripped: boolean;
};

export type SubmitSignupResult =
  | { type: "success" }
  | { type: "conflict" }
  | { type: "rateLimited" };

/**
 * Starting default per spec.md's "Open items" ("not before first real
 * event" deferral) — a real, committed number, adjustable later without
 * a redesign, not a placeholder.
 */
const RATE_LIMIT_THRESHOLD = 5;

function computePayloadDigest(input: {
  fullName: string;
  phone: string;
  cityName: string | null;
}): string {
  const normalized = JSON.stringify({
    fullName: input.fullName,
    phone: input.phone,
    cityName: input.cityName,
  });
  return createHash("sha256").update(normalized).digest("hex");
}

function currentWindowStart(): Date {
  const now = new Date();
  now.setSeconds(0, 0);
  return now;
}

async function checkIdempotency(
  prisma: PrismaClient,
  clientSubmissionId: string,
  digest: string
): Promise<SubmitSignupResult | null> {
  const existing = await prisma.supportSignup.findUnique({
    where: { clientSubmissionId },
    select: { payloadDigest: true },
  });
  if (!existing) return null;
  return existing.payloadDigest === digest ? { type: "success" } : { type: "conflict" };
}

export async function submitSignup(
  prisma: PrismaClient,
  input: SubmitSignupInput
): Promise<SubmitSignupResult> {
  const digest = computePayloadDigest(input);

  // Step 1: idempotency check (read-only, always runs first)
  const replayResult = await checkIdempotency(prisma, input.clientSubmissionId, digest);
  if (replayResult) return replayResult;

  // Step 2: atomic rate limit check (only reached for a genuinely new attempt)
  const windowStart = currentWindowStart();
  const bucket = await prisma.signupRateLimitBucket.upsert({
    where: { ip_windowStart: { ip: input.ip, windowStart } },
    create: { ip: input.ip, windowStart, count: 1 },
    update: { count: { increment: 1 } },
  });
  if (bucket.count > RATE_LIMIT_THRESHOLD) {
    return { type: "rateLimited" };
  }

  // Step 3: write (only reached after both checks pass)
  try {
    await prisma.supportSignup.create({
      data: {
        fullName: input.fullName,
        phone: input.phone,
        cityName: input.cityName,
        clientSubmissionId: input.clientSubmissionId,
        payloadDigest: digest,
        ip: input.ip,
        honeypotTripped: input.honeypotTripped,
      },
    });
    return { type: "success" };
  } catch (err) {
    // Rare race: another request inserted the same brand-new
    // clientSubmissionId between Step 1's read and this write. Prisma's
    // unique-constraint violation (P2002) plays the role of the spec's
    // "ON CONFLICT DO NOTHING" — re-run Step 1's lookup-and-compare logic
    // against the now-existing row, same replay-vs-conflict branching.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const raceResult = await checkIdempotency(prisma, input.clientSubmissionId, digest);
      if (raceResult) return raceResult;
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run the tests, confirm they pass**

```bash
npm run test -- submit-signup
```

Expected: **PASS**, all 5 tests. If the rate-limit or concurrency tests
are flaky, do not weaken the assertion — investigate whether the upsert is
genuinely atomic (it should be, via Postgres's own row-level locking on
the unique constraint) before assuming a test-infrastructure issue.

- [ ] **Step 5: Commit**

```bash
git add lib/signup/submit-signup.ts lib/signup/__tests__/submit-signup.test.ts
git commit -m "$(cat <<'EOF'
feat: implement standalone signup write path (idempotency + rate limit)

The core three-step sequence from
docs/features/standalone-signup/spec.md "Idempotency and rate limiting —
one write path": read-only idempotency check with payload-digest
comparison, atomic rate-limit bucket upsert, write only if both pass.
Integration-tested against a real Postgres, not mocked — this is exactly
where the spec's two Critical design bugs were originally caught.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `POST /api/signup` route

**Files:**
- Create: `app/api/signup/route.ts`
- Test: `app/api/signup/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `submitSignup`, `SubmitSignupInput` from `lib/signup/submit-signup.ts` (Task 4)
- Produces: `POST(request: Request): Promise<Response>` — Task 7's
  `SignupForm.tsx` calls `fetch("/api/signup", ...)` matching this route's
  path and the request/response bodies below exactly.

- [ ] **Step 1: Write the failing tests**

`app/api/signup/__tests__/route.test.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { POST } from "../route";

const prisma = new PrismaClient();

beforeAll(async () => {
  await prisma.$connect();
});

afterEach(async () => {
  await prisma.supportSignup.deleteMany();
  await prisma.signupRateLimitBucket.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function makeRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = { "x-forwarded-for": "1.2.3.4" }
) {
  return new Request("http://localhost/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/signup", () => {
  it("returns 200 success for a valid new signup", async () => {
    const response = await POST(
      makeRequest({
        fullName: "ישראל ישראלי",
        phone: "0501234567",
        cityName: "תל אביב-יפו",
        clientSubmissionId: crypto.randomUUID(),
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "success" });
  });

  it("returns 400 for a whitespace-only name", async () => {
    const response = await POST(
      makeRequest({
        fullName: "   ",
        phone: "0501234567",
        cityName: null,
        clientSubmissionId: crypto.randomUUID(),
      })
    );
    expect(response.status).toBe(400);
  });

  it("returns 409 with no leaked data when clientSubmissionId is reused with a different payload", async () => {
    const id = crypto.randomUUID();
    await POST(
      makeRequest({ fullName: "ישראל ישראלי", phone: "0501234567", cityName: null, clientSubmissionId: id })
    );
    const second = await POST(
      makeRequest({ fullName: "דנה כהן", phone: "0521112222", cityName: null, clientSubmissionId: id })
    );
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ status: "conflict" });
  });

  it("returns 200 success for a honeypot-tripped submission, indistinguishable from a real success", async () => {
    const response = await POST(
      makeRequest({
        fullName: "בוט",
        phone: "0500000000",
        cityName: null,
        clientSubmissionId: crypto.randomUUID(),
        website: "http://spam.example",
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "success" });

    const rows = await prisma.supportSignup.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].honeypotTripped).toBe(true);
  });

  it("trusts the rightmost X-Forwarded-For entry, not a client-supplied leftmost one", async () => {
    const response = await POST(
      makeRequest(
        { fullName: "א", phone: "0500000000", cityName: null, clientSubmissionId: crypto.randomUUID() },
        { "x-forwarded-for": "6.6.6.6, 7.7.7.7" }
      )
    );
    expect(response.status).toBe(200);
    const rows = await prisma.supportSignup.findMany();
    expect(rows[0].ip).toBe("7.7.7.7");
  });

  it("returns 400 when no client IP can be determined", async () => {
    const request = new Request("http://localhost/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "א",
        phone: "0500000000",
        cityName: null,
        clientSubmissionId: crypto.randomUUID(),
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 429 once the rate limit is exceeded, with zero rows written for the rejected request", async () => {
    const ip = "5.5.5.5";
    for (let i = 0; i < 5; i++) {
      const response = await POST(
        makeRequest(
          { fullName: "א", phone: "0500000000", cityName: null, clientSubmissionId: crypto.randomUUID() },
          { "x-forwarded-for": ip }
        )
      );
      expect(response.status).toBe(200);
    }
    const sixth = await POST(
      makeRequest(
        { fullName: "א", phone: "0500000000", cityName: null, clientSubmissionId: crypto.randomUUID() },
        { "x-forwarded-for": ip }
      )
    );
    expect(sixth.status).toBe(429);

    const rows = await prisma.supportSignup.findMany({ where: { ip } });
    expect(rows).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run the tests, confirm they fail**

```bash
npm run test -- app/api/signup/__tests__/route
```

Expected: **FAIL** — `../route` doesn't exist yet.

- [ ] **Step 3: Implement**

`app/api/signup/route.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { submitSignup, type SubmitSignupInput } from "@/lib/signup/submit-signup";

const prisma = new PrismaClient();

const MAX_NAME_LENGTH = 200;
const MAX_PHONE_LENGTH = 30;
const MAX_CITY_LENGTH = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonError(status: number): Response {
  return Response.json({ status: "error" }, { status });
}

/**
 * Client IP trust model — per
 * docs/features/standalone-signup/spec.md "Client IP trust model": for a
 * single reverse-proxy hop (Railway's edge, directly in front of this
 * app), the rightmost X-Forwarded-For entry is the one the edge itself
 * appended — a client-supplied value is always prepended before that.
 * Fails closed (returns null) rather than falling back to a shared
 * "unknown" bucket if no trustworthy IP can be determined.
 */
function getClientIp(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }
  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();
  return null;
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400);
  }

  if (typeof body !== "object" || body === null) {
    return jsonError(400);
  }

  const { fullName, phone, cityName, clientSubmissionId, website } = body as Record<string, unknown>;

  if (typeof fullName !== "string" || typeof phone !== "string" || typeof clientSubmissionId !== "string") {
    return jsonError(400);
  }

  const trimmedName = fullName.trim();
  if (!trimmedName || trimmedName.length > MAX_NAME_LENGTH) {
    return jsonError(400);
  }

  const trimmedPhone = phone.trim();
  if (!trimmedPhone || trimmedPhone.length > MAX_PHONE_LENGTH) {
    return jsonError(400);
  }

  let normalizedCity: string | null = null;
  if (typeof cityName === "string") {
    const trimmedCity = cityName.trim();
    if (trimmedCity.length > MAX_CITY_LENGTH) {
      return jsonError(400);
    }
    normalizedCity = trimmedCity || null;
  }

  if (!UUID_PATTERN.test(clientSubmissionId)) {
    return jsonError(400);
  }

  const ip = getClientIp(request);
  if (!ip) {
    return jsonError(400);
  }

  const honeypotTripped = typeof website === "string" && website.trim().length > 0;

  const input: SubmitSignupInput = {
    fullName: trimmedName,
    phone: trimmedPhone,
    cityName: normalizedCity,
    clientSubmissionId,
    ip,
    honeypotTripped,
  };

  const result = await submitSignup(prisma, input);

  switch (result.type) {
    case "success":
      return Response.json({ status: "success" });
    case "conflict":
      return Response.json({ status: "conflict" }, { status: 409 });
    case "rateLimited":
      return jsonError(429);
  }
}
```

- [ ] **Step 4: Run the tests, confirm they pass**

```bash
npm run test -- app/api/signup/__tests__/route
```

Expected: **PASS**, all 7 tests.

- [ ] **Step 5: Run the full suite + lint + build**

```bash
npm run test
npm run lint
npm run build
```

Expected: all exit 0 (build will still reference the old `SignupForm.tsx`/
proxy routes at this point in the plan — that's fine, Task 6/7 remove
them; this step just confirms nothing in Tasks 1-5 broke compilation).

- [ ] **Step 6: Commit**

```bash
git add app/api/signup/route.ts app/api/signup/__tests__/route.test.ts
git commit -m "$(cat <<'EOF'
feat: add POST /api/signup route

Wraps submitSignup() with request parsing, validation, client-IP
extraction (trusting the proxy-appended X-Forwarded-For entry, failing
closed if undeterminable), and the full response contract from
docs/features/standalone-signup/spec.md "API routes" — 200/409/429/400
with the exact bodies specified. Honeypot handling returns an
indistinguishable success response.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Delete the old proxy architecture

**Files:**
- Delete: `lib/proxy.ts`
- Delete: `app/api/proxy/` (entire directory — `cities/`,
  `support-links/[code]/`, `support-signup/`, and
  `support-signup/[id]/interest/`, the last of which is still present and
  committed on `develop` despite an old doc claiming otherwise)

**Interfaces:**
- Consumes: nothing
- Produces: nothing — pure deletion. Task 7 depends on these files being
  gone (no lingering import of `lib/proxy.ts` anywhere).

- [ ] **Step 1: Confirm what's actually there before deleting**

```bash
ls -la app/api/proxy/
find app/api/proxy -type f
```

Expected: `cities/route.ts`, `support-links/[code]/route.ts`,
`support-signup/route.ts`, `support-signup/[id]/interest/route.ts` — all
four. If the fourth is somehow already gone, note that in the commit
message instead of claiming to have deleted something that wasn't there.

- [ ] **Step 2: Delete**

```bash
rm lib/proxy.ts
rm -rf app/api/proxy
```

- [ ] **Step 3: Search for any remaining references**

```bash
grep -rn "lib/proxy\|forwardToManagementApp\|api/proxy" --include="*.ts" --include="*.tsx" app lib 2>/dev/null
```

Expected: no output (Task 7 hasn't run yet in this plan, but
`SignupForm.tsx` at this point in history still calls `/api/proxy/*` —
that's expected and gets fixed in Task 7, not here; this grep is to catch
anything unexpected in files Task 7 doesn't touch, like a stray import
elsewhere).

- [ ] **Step 4: Commit**

```bash
git add -A lib/proxy.ts app/api/proxy
git commit -m "$(cat <<'EOF'
chore: delete the old proxy-to-corporations architecture

lib/proxy.ts and all four routes under app/api/proxy/ (including the
already-separately-deprecated .../interest route, still committed here)
— replaced by app/api/signup/route.ts. This app no longer calls
corporations at runtime.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

(Note: `SignupForm.tsx` still references the now-deleted routes at this
exact commit — the repo is intentionally non-functional between this
commit and Task 7's. This is acceptable within a single plan's linear
history; if that matters for deployment safety, tasks 6 and 7 can be
squashed into one commit at execution time instead — a judgment call for
whoever runs this plan, not a spec requirement.)

---

### Task 7: Rewrite `SignupForm.tsx` and its page routes

**Files:**
- Modify: `app/join/SignupForm.tsx`
- Modify: `app/join/page.tsx`
- Delete: `app/join/[code]/` (entire directory)

**Interfaces:**
- Consumes: `CITIES` from `lib/cities.ts` (Task 3); calls
  `POST /api/signup` (Task 5)
- Produces: `SignupForm` — now a zero-prop component (`export function
  SignupForm()`, no `{ linkCode }` parameter) — Task 8's tests render it
  with no props.

- [ ] **Step 1: Rewrite `SignupForm.tsx`**

Full file, `app/join/SignupForm.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import styles from "./SignupForm.module.css";
import { CITIES } from "@/lib/cities";

type Step = "form" | "submitting" | "done";

export function SignupForm() {
  const [step, setStep] = useState<Step>("form");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cityName, setCityName] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());
  const ambiguousFailurePendingRef = useRef(false);
  const lastAttemptedPayloadRef = useRef<string | null>(null);

  function invalidateSubmissionIdIfNeeded() {
    if (ambiguousFailurePendingRef.current) {
      ambiguousFailurePendingRef.current = false;
      setSubmissionId(crypto.randomUUID());
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setError("אנא הזן שם מלא");
      return;
    }

    const payloadKey = JSON.stringify({ trimmedName, phone, cityName });

    let idToUse = submissionId;
    if (ambiguousFailurePendingRef.current && payloadKey !== lastAttemptedPayloadRef.current) {
      idToUse = crypto.randomUUID();
    }
    ambiguousFailurePendingRef.current = false;
    lastAttemptedPayloadRef.current = payloadKey;
    if (idToUse !== submissionId) {
      setSubmissionId(idToUse);
    }

    setStep("submitting");

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: trimmedName,
          phone,
          ...(cityName ? { cityName } : {}),
          clientSubmissionId: idToUse,
          website: honeypot,
        }),
      });

      if (!response.ok) {
        ambiguousFailurePendingRef.current = false;
        setSubmissionId(crypto.randomUUID());
        setError("אירעה שגיאה. נסו שוב בעוד רגע.");
        setStep("form");
        return;
      }

      ambiguousFailurePendingRef.current = false;
      setSubmissionId(crypto.randomUUID());
      setStep("done");
    } catch {
      ambiguousFailurePendingRef.current = true;
      setError("אירעה שגיאה. נסו שוב בעוד רגע.");
      setStep("form");
    }
  }

  if (step === "done") {
    return (
      <div className={`${styles.wrap} ${styles.thankYou}`}>
        <h1 className="text-heading">תודה שהצטרפת כתומכ/ת!</h1>
        <p className="text-body">יחד נוכל להשפיע.</p>
      </div>
    );
  }

  return (
    <form className={styles.wrap} onSubmit={handleSubmit}>
      <h1 className="text-heading">מצטרפ/ת כתומכ/ת</h1>

      <div className={styles.field}>
        <label className="text-label" htmlFor="fullName">
          שם מלא
        </label>
        <input
          id="fullName"
          className={styles.input}
          type="text"
          required
          maxLength={200}
          value={fullName}
          onChange={(event) => {
            invalidateSubmissionIdIfNeeded();
            setFullName(event.target.value);
          }}
        />
      </div>

      <div className={styles.field}>
        <label className="text-label" htmlFor="phone">
          טלפון נייד
        </label>
        <input
          id="phone"
          className={styles.input}
          type="tel"
          inputMode="numeric"
          required
          maxLength={30}
          value={phone}
          onChange={(event) => {
            invalidateSubmissionIdIfNeeded();
            setPhone(event.target.value);
          }}
        />
      </div>

      <div className={styles.field}>
        <label className="text-label" htmlFor="city">
          עיר (לא חובה)
        </label>
        <select
          id="city"
          className={styles.select}
          value={cityName}
          onChange={(event) => {
            invalidateSubmissionIdIfNeeded();
            setCityName(event.target.value);
          }}
        >
          <option value="">ללא ציון עיר</option>
          {CITIES.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>

      {/* Honeypot — invisible to real users, spec "Abuse controls" */}
      <div className={styles.honeypot} aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>

      {error && <p className={`text-body ${styles.error}`}>{error}</p>}

      <button className={styles.submit} type="submit" disabled={step === "submitting"}>
        מצטרפ/ת כתומכ/ת
      </button>
    </form>
  );
}
```

Everything about `loading`/`inactive` states, the link-check `useEffect`,
the `cities` state (now a static import instead), and the `linkCode` prop
is gone. The field-validation logic (name trim, `maxLength`) and the
`clientSubmissionId` lifecycle logic (the payload-fingerprint-based
reuse/rotation rules) are carried forward unchanged from `develop` — only
`linkCode` is dropped from `payloadKey` and the request body, since there
is no link concept left at all.

- [ ] **Step 2: Simplify `app/join/page.tsx`**

Full file:

```tsx
import { SignupForm } from "./SignupForm";

export const metadata = { title: "מצטרפים | עמך ישראל" };

export default function JoinPage() {
  return <SignupForm />;
}
```

- [ ] **Step 3: Delete `app/join/[code]/`**

```bash
rm -rf "app/join/[code]"
```

- [ ] **Step 4: Run lint + build**

```bash
npm run lint
npm run build
```

Expected: both exit 0. (The existing Vitest suite will fail at this point
— that's Task 8, not this task; don't be alarmed by red tests here, only
by lint/build failures.)

- [ ] **Step 5: Commit**

```bash
git add app/join/SignupForm.tsx app/join/page.tsx "app/join/[code]"
git commit -m "$(cat <<'EOF'
feat(join): rewrite SignupForm for the standalone backend

Drops the linkCode prop, the link-check useEffect, and the
loading/inactive states entirely — the form is always immediately
visible. Request body now sends cityName (not cityId) with no linkCode,
posted to /api/signup. City options come from the static list (lib/cities.ts)
instead of a fetch. Field validation and the clientSubmissionId lifecycle
rules are unchanged from develop. Deletes /join/[code] (no longer a valid
route — no link concept left).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Rewrite the Vitest suite

**Files:**
- Modify: `app/join/__tests__/test-utils.tsx`
- Modify: `app/join/__tests__/SignupForm.smoke.test.tsx`
- Modify: `app/join/__tests__/SignupForm.city.test.tsx`
- Modify: `app/join/__tests__/SignupForm.name-validation.test.tsx`
- Modify: `app/join/__tests__/SignupForm.maxlength.test.tsx`
- Modify: `app/join/__tests__/SignupForm.submission-id.test.tsx`

**Interfaces:**
- Consumes: `SignupForm` (Task 7, zero-prop now)
- Produces: `renderForm(signupImpl?)`, `installFetchMock(signupImpl?)`,
  `jsonResponse(body, status?)`, `submittedBody(fetchMock, callIndex?)` —
  the new shared test-helper surface, replacing the old
  `renderFormReady`/multi-endpoint `installFetchMock`.

- [ ] **Step 1: Rewrite the shared test helper**

`app/join/__tests__/test-utils.tsx`:

```tsx
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
```

- [ ] **Step 2: Rewrite the smoke test**

`app/join/__tests__/SignupForm.smoke.test.tsx`:

```tsx
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
```

- [ ] **Step 3: Rewrite the city field test**

`app/join/__tests__/SignupForm.city.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderForm, submittedBody } from "./test-utils";

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/שם מלא/), "ישראל ישראלי");
  await user.type(screen.getByLabelText(/טלפון נייד/), "0501234567");
}

describe("SignupForm city field", () => {
  it("does not mark the city select as required", () => {
    renderForm();
    expect(screen.getByLabelText(/עיר/)).not.toBeRequired();
  });

  it("labels the field as optional", () => {
    renderForm();
    expect(screen.getByText("עיר (לא חובה)")).toBeInTheDocument();
  });

  it("offers a selectable, real 'no city' option instead of a disabled placeholder", () => {
    renderForm();
    const blankOption = screen.getByRole("option", { name: "ללא ציון עיר" });
    expect(blankOption).not.toBeDisabled();
  });

  it("omits cityName from the request body when left blank", async () => {
    const user = userEvent.setup();
    const fetchMock = renderForm();
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));
    const body = submittedBody(fetchMock);
    expect(body).not.toHaveProperty("cityName");
  });

  it("sends cityName when a city is selected", async () => {
    const user = userEvent.setup();
    const fetchMock = renderForm();
    await fillRequiredFields(user);
    await user.selectOptions(screen.getByLabelText(/עיר/), "תל אביב-יפו");
    await user.click(screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));
    const body = submittedBody(fetchMock);
    expect(body.cityName).toBe("תל אביב-יפו");
  });

  it("lets the supporter pick a city and then return to 'no city'", async () => {
    const user = userEvent.setup();
    renderForm();
    const select = screen.getByLabelText<HTMLSelectElement>(/עיר/);
    await user.selectOptions(select, "תל אביב-יפו");
    expect(select.value).toBe("תל אביב-יפו");
    await user.selectOptions(select, "");
    expect(select.value).toBe("");
  });
});
```

- [ ] **Step 4: Update the name-validation test**

`app/join/__tests__/SignupForm.name-validation.test.tsx` — same two tests
as before, only the render call changes from `await renderFormReady()` to
`renderForm()` (synchronous now, no `await`):

```tsx
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
```

(Note this is now able to assert `fetchMock` was never called at all for
the invalid case, rather than filtering by URL — with only one endpoint,
"not called" is unambiguous.)

- [ ] **Step 5: Update the maxLength test**

`app/join/__tests__/SignupForm.maxlength.test.tsx` — identical to before,
only the render call changes:

```tsx
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

  it("caps the phone input at 30 characters, matching the server schema", () => {
    renderForm();
    expect(screen.getByLabelText<HTMLInputElement>(/טלפון נייד/)).toHaveAttribute(
      "maxLength",
      "30"
    );
  });
});
```

- [ ] **Step 6: Rewrite the submission-id lifecycle test**

`app/join/__tests__/SignupForm.submission-id.test.tsx`:

```tsx
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
```

(Same three scenarios as the `develop`-branch version — only the mock
shape changed, from a `{link, cities, signup}` object to a single
callback, since there's only one endpoint now. `linkCode` never appeared
in these tests' assertions to begin with, so no change needed there.)

- [ ] **Step 7: Run the full suite**

```bash
npm run test
```

Expected: **PASS**, every test across all six files (smoke, city,
name-validation, maxlength, submission-id, plus Tasks 4/5's
`submit-signup`/`route` tests) — this is the first point in the plan
where the whole test suite is green again after Task 6/7's intentional
breakage.

- [ ] **Step 8: Run lint + build**

```bash
npm run lint
npm run build
```

Expected: both exit 0.

- [ ] **Step 9: Commit**

```bash
git add app/join/__tests__
git commit -m "$(cat <<'EOF'
test: rewrite Vitest suite for the standalone signup backend

New single-endpoint (/api/signup) mock shape in test-utils.tsx, replacing
the old link/cities/signup multi-endpoint mock. Drops every test that
asserted on link-check/loading/inactive behavior (no longer exists).
Field-validation and clientSubmissionId-lifecycle tests carry forward
with updated (synchronous) render calls and cityName-not-cityId
assertions.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Mark the spec implemented (final task, after everything else is verified)

**Files:**
- Modify: `docs/features/standalone-signup/spec.md`
- Modify: `docs/README.md`

**Interfaces:**
- Consumes: nothing — this task only runs once Tasks 1-8 are complete,
  tested, and (per whoever is deploying) live.
- Produces: nothing consumed elsewhere — purely documentation.

- [ ] **Step 1: Update the spec's Status line**

In `docs/features/standalone-signup/spec.md`, change:

```
**Status:** Approved design, pending implementation plan
```

to:

```
**Status:** Implemented (docs/superpowers/plans/2026-08-31-standalone-signup-backend.md) — deployed to dev, [prod deployment status: fill in truthfully at execution time, don't assume]
```

Do not mark this "deployed to prod" unless it actually has been — leave
that clause honest about whatever the real state is when this task
actually runs.

- [ ] **Step 2: Update `docs/README.md`'s "Current status" section**

Replace the "Architecture decision (2026-08-31)... designed but not yet
implemented" framing with a truthful statement that the standalone
backend is now implemented (and, if true at execution time, deployed) —
mirroring the same "don't claim more than is actually verified" rule as
Step 1. Update the "Field-level fixes shipped to `develop`/dev" paragraph
to note they've now been adapted to the new wire contract (Task 7), not
still pending adaptation.

- [ ] **Step 3: Commit**

```bash
git add docs/features/standalone-signup/spec.md docs/README.md
git commit -m "$(cat <<'EOF'
docs: mark standalone signup backend as implemented

Tasks 1-8 of docs/superpowers/plans/2026-08-31-standalone-signup-backend.md
are complete and verified (full test suite green, lint/build clean).
Updates spec.md's Status line and docs/README.md's current-status section
to reflect implementation, not just design.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:** "Scope cut for v1" → Task 7 (no `/join/[code]`, no
link states). "Data model" → Task 2. "Idempotency and rate limiting" →
Task 4. "`SignupRateLimitBucket`" → Task 2. "Client IP trust model" →
Task 5. "City list" → Task 3. "Abuse controls" (honeypot) → Tasks 5/7.
"Validation" → Task 5. "API routes" (route table + response contract) →
Tasks 5/6. "Relationship to existing `/join` work" (component rewrite,
test-suite rewrite, dropped `linkCode`) → Tasks 7/8. "Infrastructure"
(separate dev Postgres instance) → Task 1. Every non-"Open items" section
of the spec maps to a task. "Open items" (exact city list, route naming,
rate-limit numbers, digest normalization) are each resolved with a real,
committed value in the relevant task rather than left as a TBD — matching
the spec's own instruction that these don't block implementation, just
needed a concrete pick.

**Placeholder scan:** no TBD/TODO; every code step is complete, runnable
code, not a description of code. Task 9's Status-line update is the one
place with an explicit "fill in truthfully" instruction — that's
deliberate (it depends on real-world deploy state unknowable when this
plan was written), not a placeholder for missing design work.

**Type consistency:** `SubmitSignupInput`/`SubmitSignupResult` (Task 4)
are imported by name into Task 5's route with matching field names
throughout. `submitSignup(prisma, input)`'s signature is identical
everywhere it's called (Task 4's tests, Task 5's route). `CITIES` (Task 3)
is imported and iterated identically in Task 7. `renderForm`/
`installFetchMock`/`jsonResponse`/`submittedBody` (Task 8) have identical
names and call signatures across all five test files that import them —
verified by reading each file's usage above. `SignupForm` goes from
`{ linkCode }: { linkCode: string }` to a zero-prop function consistently
across Task 7 (the component) and Task 8 (every test's `render(<SignupForm
/>)` call via `renderForm()`, no prop passed anywhere).
