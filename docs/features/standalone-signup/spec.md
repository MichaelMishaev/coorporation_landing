# Standalone Signup Backend

**Date:** 2026-08-31
**Status:** Implemented (docs/superpowers/plans/2026-08-31-standalone-signup-backend.md,
plus a post-final-review hardening pass) on branch
`standalone-signup-backend` — code complete, reviewed, and committed.
Not yet merged into `develop`, not yet deployed to dev or prod. Dev
Railway service has `DATABASE_URL` and a migration pre-deploy command
already wired; prod has no dedicated Postgres yet.
**Supersedes:** `docs/features/supporter-self-signup/spec.md` — that document's
whole architecture (same-origin proxy to `corporations`' `/api/public/*`,
`SupportLink` codes, attribution to `corporations`' `User` records) is
replaced by this one. Not deleted — kept as historical record per this
repo's convention of marking supersession inline rather than removing.
`docs/features/join-form/spec.md` is also partially superseded: its
field-value decisions (name/phone mandatory, city optional, validation,
the `clientSubmissionId` generation/rotation rules) carried forward
unchanged at implementation time. **City is now mandatory (2026-09-01)**
— see Validation below. Everything about entry points and link validity (the
`/join`/`/join/[code]` split, the mount gate, the `loading`/`inactive`
states, the wire contract) does not — see "Relationship to existing
`/join` work" below for the full, precise breakdown.

## Decision

This app (`coorporationLanding`) becomes fully standalone: its own
database, its own signup-storage logic, zero runtime dependency on the
`corporations` repo/service. This is a **permanent architecture decision**,
not a temporary workaround for `corporations` not having deployed
`/api/public/*` yet (confirmed independently unavailable on both its `dev`
and `prod` backends during this session — see git history around
2026-08-31 for the verification).

**Why — and the honest version of this argument, corrected in this
revision.** An earlier draft compared this app's new blast radius only
against `corporations`' much larger `Voter`/`User` schema and concluded
"smaller, therefore fine." That's the wrong baseline. The comparison that
actually matters is against **this app's own prior state**: before this
change, a full compromise of this app yielded zero at-rest personal data
— that was the entire point of the original no-DB, no-auth design. After
this change, a full compromise yields the complete supporter list:
`fullName`, `phone`, `cityName`, `ip`, timestamps — names and phone
numbers tied to declared political affiliation, a sensitive category
under both Israeli privacy law and GDPR, held for the first time by an
app with **no authentication protecting it at all**. That is a real,
new risk this app is taking on, not a small one, and it deserves to be
named plainly rather than minimized by comparing against a bigger
system elsewhere.

**The decision is still made deliberately, for reasons that hold up once
stated honestly, not because the risk is small:**
- Zero dependency on `corporations` being deployed, maintained, or even
  online — this app's core function (accept a signup) no longer has an
  external failure mode at all.
- The data collected is exactly what a supporter already chose to submit
  through a public form with no login — not a secret extracted from
  them, and not commingled with any of `corporations`' broader voter
  data, roles, or credentials.
- The alternative (staying dependent on a backend that, as of this
  writing, doesn't exist and has no committed timeline) has its own cost:
  zero real signups collected at all.

**What this decision does *not* yet have an answer for, flagged
explicitly rather than glossed over — genuine open items for whoever
implements this, not resolved by this document:**
- No retention or deletion policy for `SupportSignup` data. `/privacy` is
  still a placeholder stub in this app (see root `README.md`) — that was
  an acceptable gap when this app held no data at all; it is not once it
  does.
- No access-control policy for who can query this data operationally
  (Railway dashboard access, direct DB access for support/debugging) —
  there was nothing to access before.
- No backup/restore policy has been considered for the new Postgres.
- **The same-Railway-project placement (see "Infrastructure" below) is
  not actually neutral to this blast-radius argument, and an earlier
  draft's "same-project ≠ shared data" framing missed this:** it's true
  for the data plane, but a compromised Railway account, team member, or
  an over-broad deployment token reaches *both* this app's and
  `corporations`' services either way, regardless of database isolation.
  That's a real, if pre-existing, shared exposure — this decision doesn't
  create it, but doesn't reduce it either, and shouldn't be described as
  though project-sharing were irrelevant to risk.

None of the above blocks this spec — they're accepted v1 gaps, the same
way the rest of this document accepts v1 scope cuts elsewhere — but they
are risk, not merely "future polish," and are named here so nobody reads
this document later and assumes they were considered and dismissed.

**Branch-state note:** this spec's "already implemented in
`app/join/SignupForm.tsx`" claims below refer to the state on the
`develop` branch (where `docs/features/join-form/spec.md`'s Tasks 0-4 are
merged) — not `main`, which as of this writing still has the pre-fix
component (including the already-separately-removed volunteer-interest
code sitting mid-limbo: gone from `develop`, still present in `main`'s
history). Confirm which branch you're implementing against before reusing
any "already implemented" claim in this document.

## Scope cut for v1: no personal recruiter links

The current design's whole `SupportLink` concept (personal links,
attribution to a `corporations` `User`, `/join/[code]`, the
`loading → check link → inactive/form` client state machine) exists only
to support **multiple, revocable, per-recruiter-attributed** links — which
requires knowing which internal user owns a link, which requires knowing
about `corporations`' `User` table. A standalone app has no such concept,
and building one (auth, a recruiter/user model, a "generate my link" UI)
is real, non-trivial new scope that was not asked for.

**v1 decision: one static signup form, always live, no code.**

- `/join` renders the form unconditionally — no link-validity check, no
  `loading`/`inactive` states tied to a code.
- `/join/[code]` is dropped entirely. Any existing links pointing at it
  (QR codes, shared URLs) start 404ing the moment this ships — flagged
  here as a real, accepted consequence, not an oversight. No redirect
  shim is planned for v1 (YAGNI — nothing currently drives real traffic
  to a personal link, since `corporations` never got far enough to issue
  any).
- Personal recruiter links, if ever wanted again, are an explicit v2
  scope decision requiring its own spec (a real auth/user system for this
  app) — not something this spec designs for speculatively.

## Data model

New Prisma schema, new Postgres, in this repo (`coorporationLanding`
currently has neither).

### `SupportSignup`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, `@id @default(uuid())` | |
| `fullName` | string, `@db.VarChar(200)` | Trimmed server-side too, not just client-side — mirrors `docs/features/join-form/spec.md` scenario 4's client-side rule, enforced again at the boundary. 200-char cap matches the client `maxLength` (see "Validation" below). |
| `phone` | string, `@db.VarChar(30)` | No format validation beyond non-empty + max length (same policy as the existing join-form spec: stay unvalidated client-side per that doc's scenario 1 reasoning). 30-char cap matches the client `maxLength`. |
| `cityName` | string, nullable, `@db.VarChar(100)` | Free text, from the static city list (see below). **Mandatory on new submissions (2026-09-01)** — missing, non-string, or whitespace-only values are rejected server-side. The column stays nullable so rows collected while the field was optional remain valid. Not stored as `""`. **100-char cap** — comfortably exceeds every real city name on the static list and rejects anything pathological. |
| `clientSubmissionId` | string, `@unique` | Idempotency key. See "Idempotency" below — this alone is **not** sufficient to detect payload-mismatched key reuse; paired with `payloadDigest`. |
| `payloadDigest` | string | SHA-256 (or similar) hash of the normalized `{fullName, phone, cityName}` the client actually sent under this `clientSubmissionId`. Exists specifically to detect the case the plain unique constraint alone cannot: the same key reused with different data. See "Idempotency." |
| `ip` | string | **Not nullable.** See "Client IP trust model" below — the fallback/trust policy is a real decision in this revision, not a blind carry-forward from the old proxy. Stored here for abuse review; the actual rate-limit key lives on `SignupRateLimitBucket.ip` (same value, same policy). |
| `honeypotTripped` | boolean, `@default(false)` | A honeypot-tripped submission still gets a real row (fullName/phone are NOT NULL, so there's no way to omit them) — flagged, not hidden. Abuse review filters `WHERE honeypotTripped = true` instead of the row not existing. Rate-limiting counts these rows the same as any other, since they represent real traffic from that IP regardless of outcome. |
| `createdAt` | timestamp, `@default(now())` | |

No `SupportLink` table. No `User`/attribution table. One table, matching
the v1 scope cut above.

### Idempotency and rate limiting — one write path

**An earlier draft of this section had a real, uncaught bug: it specified
inserting first and rate-limiting second, with no transaction, which means
a request the rate limiter goes on to reject would already be permanently
stored** — the exact opposite of what a cap on stored rows is for, and
self-reinforcing besides (a rejected attempt still counts toward the
limit that rejected it, since the row exists). Fixed by reordering to
**read before writing**, for both checks, and writing exactly once, at
the end, only if both checks pass:

**Step 1 — idempotency check (read-only, always runs first):**

```sql
SELECT "payloadDigest" FROM "SupportSignup" WHERE "clientSubmissionId" = $1;
```

- **No row:** genuinely new attempt — continue to Step 2. Rate limiting
  is never consulted for a replay, matching the old design's explicit
  rule that "daily-cap consumption... only fires for a genuinely new
  attempt."
- **Row found, digest matches** the current request's payload: true
  replay (the ambiguous-failure-retry case
  `docs/features/join-form/spec.md` scenario 2 is designed around) —
  return the existing row's success result immediately. No write, no
  rate-limit check.
- **Row found, digest differs:** the key is reused with different data —
  return a `409`-shaped conflict response (see "API routes" below for the
  exact shape) immediately. No write, no rate-limit check. Per the
  client-side lifecycle rules (same scenario 2), this should only happen
  from a buggy/malicious client — a spec-compliant client always mints a
  fresh id on any field edit — but the server must not trust that and
  must reject rather than guess. The response body must not leak the
  existing row's contents (no name/phone disclosure to a caller who
  didn't originally submit them).

**Step 2 — rate limit, atomic increment-and-check (only reached for a
genuinely new attempt):**

```sql
INSERT INTO "SignupRateLimitBucket" ("ip", "windowStart", "count")
VALUES ($ip, date_trunc('minute', now()), 1)
ON CONFLICT ("ip", "windowStart") DO UPDATE
  SET "count" = "SignupRateLimitBucket"."count" + 1
RETURNING "count";
```

A second, small table — not a `COUNT(*)` over `SupportSignup` followed by
a separate `INSERT`. That two-step form was this draft's other real gap:
it's not atomic, so concurrent requests from the same IP can all read a
count under the threshold and all proceed, and the overshoot is bounded by
however many requests an attacker fires at once, not by "a handful during
a race." The upsert above is one atomic statement — Postgres serializes
concurrent upserts to the same `(ip, windowStart)` key, so the returned
`count` is always correct, no race. (`windowStart` bucketed to the minute
here as an illustration; the actual bucket width is the same
"not before first real event" deferral as the threshold itself — see
"Open items.")

- **`count` exceeds the configured threshold:** reject (`429`). Nothing is
  written to `SupportSignup` — the bucket increment already happened (that
  table exists to count *attempts*, not successes, so counting a rejected
  one is correct and intentional), but the signup data itself is never
  persisted for a capped request.
- **`count` is within the threshold:** continue to Step 3.

**Step 3 — write (only reached after both checks pass):**

```sql
INSERT INTO "SupportSignup" (..., "clientSubmissionId", "payloadDigest", ...)
VALUES (..., $clientSubmissionId, $payloadDigest, ...)
ON CONFLICT ("clientSubmissionId") DO NOTHING
RETURNING *;
```

This can still (rarely) conflict: two concurrent requests with the same
brand-new `clientSubmissionId` can both pass Step 1's `SELECT` (neither
sees the other's not-yet-committed row) and both reach Step 3. `ON
CONFLICT ... DO NOTHING` makes the loser's `INSERT` a no-op instead of an
error; if no row comes back here, re-run Step 1's lookup-and-compare logic
against the now-existing row (same replay-vs-conflict branching) — this
is the one place a "no row, then no row again" edge case could occur, and
it's handled by the same digest comparison, not a separate code path.

**Isolation level: READ COMMITTED (Postgres's default) — do not raise it
for this path.** Every read above is meant to see the latest committed
state, including a commit that happened between Step 1 and Step 3; a
higher isolation level (REPEATABLE READ or stricter) would let Step 1's
`SELECT` run against a snapshot that predates a concurrent commit,
producing exactly the "no row, then a conflicting insert" case Step 3's
fallback handles — which is fine as a rare, handled edge case, but would
become the *common* case under a stricter isolation level, which this
design does not assume or want.

**Digest algorithm:** plain SHA-256 over the normalized `{fullName,
phone, cityName}`, not an HMAC. The old `OfflineMutationReceipt` design
used HMAC because forging a matching digest would let an authenticated
`corporations` caller collide with another actor's receipt in a
multi-tenant, multi-mutation-kind system; here, `payloadDigest` only ever
detects an honest client's own key/payload mismatch (a bug, not an
attack an unkeyed hash meaningfully changes the exposure of) — an
attacker gains nothing from computing a matching digest, since they'd
still need to know and reuse someone else's exact `clientSubmissionId`
first, which is the actual access-controlled fact here, not the hash. If
this reasoning is ever judged insufficient, keying the hash with a server
secret is a trivial addition, not a redesign.

## `SignupRateLimitBucket` (new table, alongside `SupportSignup`)

| Field | Type | Notes |
|---|---|---|
| `ip` | string | Same value/fallback policy as `SupportSignup.ip` — see "Client IP trust model" below, this is where that decision actually matters. |
| `windowStart` | timestamp | Bucketed window start (exact width: implementation-time, see "Open items"). |
| `count` | int, `@default(0)` | Incremented atomically per Step 2 above. |

`@@unique([ip, windowStart])` — the constraint the `ON CONFLICT` clause
targets. Old buckets are never queried once their window has passed; a
periodic cleanup job (delete rows older than N windows) is a trivial
implementation-time addition, not architectural.

## Client IP trust model — a real decision, not a carry-forward

**An earlier draft of this section claimed the current proxy's IP-fallback
policy (`x-forwarded-for` → `x-real-ip` → `"unknown"`, trusting the
leftmost `x-forwarded-for` entry) could be "carried forward unchanged."
That claim doesn't hold, and stating it as unchanged was itself a bug in
this document, not just an omission.** Under the old architecture, this
app's own server computed that value from its inbound connection and
forwarded it to `corporations` behind a shared secret only this server
held — `corporations` trusted the value *because* it could only have come
from a request bearing that secret, not because the header itself was
inherently trustworthy. Standalone, this app's server **is** the
internet-facing edge for the first time. The browser can set
`X-Forwarded-For` to anything; if this app's IP-extraction logic naively
takes the leftmost entry, an attacker sets their own forged first entry
and defeats the per-IP rate limit and the stored abuse-review `ip`
outright — the exact "we are now the trust boundary and used to not be"
problem this whole architecture change creates in miniature.

**Decision:** trust only the IP Railway's own edge appends to
`X-Forwarded-For` for a direct client connection — for a single
reverse-proxy hop (which is what Railway's edge is, sitting directly in
front of this app with no other proxy in between), that is the
**rightmost** entry, not the leftmost; a client-supplied `X-Forwarded-For`
value is always prepended before Railway's edge appends the real one.
This must be verified against Railway's actual, current edge behavior at
implementation time before being trusted for something rate-limit-bearing
— flagged explicitly as a pre-implementation check, not assumed here.

**The `"unknown"` fallback also needs re-examination, not a blind
carry-forward:** if it's genuinely impossible to determine a real IP
(header missing entirely), bucketing every such request into one shared
`"unknown"` bucket means one attacker exhausting that bucket can lock out
every other visitor hitting the same fallback — an availability failure
this design must not silently accept. Decision: if no trustworthy IP can
be determined, **reject the request** (fail closed on this specific,
narrow condition) rather than fall back to a shared bucket — consistent
with the old design's own already-established principle that this route
fails closed on infrastructure uncertainty rather than admitting
unlimited/unattributable traffic.

The client-side lifecycle rules already built in
`docs/features/join-form/spec.md` scenario 2 (reuse the id across a retry
after an ambiguous failure with an unchanged payload, mint a fresh one on
any definitive response or field edit) **carry forward unchanged** — this
spec only changes what happens to the id server-side, not the client's
generation/rotation rules. One decision from that document's "City
handling" section does **not** carry forward and needs its own explicit
note: the old spec's "inherit city from the link owner's own city when
the owner has a single city" behavior is fully moot under the v1 scope
cut (no link, no owner) — not implemented, not deferred, just gone along
with the link concept itself.

## City list

Stops being fetched from `corporations`. Becomes a small static list
shipped in this repo (a plain array, not a DB table — YAGNI: nothing
about this list needs to be admin-editable or queried, it's a fixed set of
Israeli city names for a single-client campaign app). Same free-text
storage pattern as before (`cityName`), just locally sourced instead of
proxied.

Exact list is an implementation-time decision (source: the same
recognizable Israeli-city set `corporations`' `City` table already has,
or a shorter campaign-relevant subset) — not architectural, doesn't block
this spec.

## Abuse controls beyond rate limiting

The rate-limiting mechanism itself (atomic, Postgres-backed, no new Redis
service) is specified above under "Idempotency and rate limiting — one
write path" and "`SignupRateLimitBucket`" — not repeated here.

**Honeypot — wire contract, since an earlier draft left this entirely
unspecified despite claiming it "carries forward unchanged."** There is
no prior spec to carry it forward *from* with a concrete contract, so this
is being specified for the first time, not restated:

- Request field: a field named e.g. `website` in the POST body (matching
  `app/join/SignupForm.tsx`'s existing hidden honeypot input's `id` —
  exact name is implementation-time, must just match whatever the client
  sends).
- **Tripped** means: present in the request body and non-empty after
  trimming. A field that's absent, or present-but-whitespace-only, is not
  tripped (a real browser always sends the field; only a scripted client
  skipping the DOM entirely would omit it).
- **Response when tripped:** the **same** success response shape a real
  signup gets (see "API routes" below) — never a distinguishing error,
  status code, or message, so a scripted client can't learn it was caught
  and adjust. Internally: insert with `honeypotTripped = true` (still
  subject to the exact same idempotency and rate-limit steps above — a
  honeypot-tripped attempt is not exempt from either), review-only, never
  surfaced to the submitter.

**Does not carry forward: the submission-timing check.** The original
spec named "submission-timing check (reject submissions faster than a
human can plausibly fill the form)" as an abuse control, but never
actually specified a mechanism (no timestamp field, no token, no
threshold) — there is nothing concrete to carry forward. Dropped from v1's
claimed abuse controls rather than restated as "unchanged" against a
design that was never real. If timing-based bot detection is wanted, it
needs its own from-scratch design (e.g. a server-issued, short-lived,
signed timestamp returned with the initial page load and checked against
the submit time) — an explicit v2 item, not silently assumed present.

## Validation

Server-side, independent of whatever the client already enforces (never
trust client-side validation alone as the only gate):

- `fullName`: required, trimmed, reject if empty after trim (mirrors
  `docs/features/join-form/spec.md` scenario 4), max 200 chars (reject
  over-length rather than silently truncate — matches the client
  `maxLength`, which already prevents typing past it, so an over-length
  value server-side only happens via a non-browser client, and truncating
  a stranger's submitted name silently is worse than a clean rejection).
- `phone`: required, non-empty, max 30 chars. No format/shape validation
  beyond that — same policy `docs/features/join-form/spec.md` scenario 1
  already chose (stay unvalidated rather than add a regex), now simply
  applied at this app's own boundary instead of relying on a
  `corporations`-side check that no longer exists.
- `cityName`: required. Trim; reject if missing, not a string, or empty
  after trim. Max 100 chars (reject over-length rather than silently
  truncate). **Not validated against the static city list** —
  free-text storage with no re-validation against a canonical list is the
  same policy the superseded spec already established for city data
  (`docs/features/supporter-self-signup/spec.md` "City handling": "store
  free text, never re-validate"), carried forward for consistency even
  though the *reason* for it (deferring to a caller-scoped canonical
  city elsewhere) no longer applies — simplicity or a fixed
  known-good city picker on the client makes a server-side allowlist check
  low-value anyway.
- `clientSubmissionId`: required, must be a syntactically valid UUID
  (reject malformed values before they ever reach the idempotency logic
  above — an invalid UUID is a client bug, not a replay to reason about).

## API routes

Replaces every `/api/proxy/*` route with real logic living directly in
this repo:

| Old route | New route | Change |
|---|---|---|
| `GET /api/proxy/cities` | *(removed, no replacement route)* | **Decided, not left open:** the city list ships as a plain static array imported directly into the client bundle — no route, no network round-trip, ever. (An earlier draft left this as an either/or between "removed" and "a trivial local route," which was itself an unresolved ambiguity — this is the one decision, not both.) |
| `GET /api/proxy/support-links/{code}` | *(removed)* | No link concept in v1 — nothing to check. |
| `POST /api/proxy/support-signup` | `POST /api/signup` (or equivalent — naming is implementation-time) | Real logic: idempotency check, rate limiting, validation, insert into `SupportSignup` — the full write path specified above. No more forwarding, no more `X-Public-Proxy-Secret`/`X-Original-Client-IP` headers — this route reads the real request directly. |
| `POST /api/proxy/support-signup/{id}/interest` | *(removed)* | **This route is still present and committed on `develop`** (verified directly) despite `docs/features/join-form/spec.md` scenario 5 describing it as already deleted — that claim was only ever true of an uncommitted local working tree, never of any committed branch. It imports `forwardToManagementApp` from `lib/proxy.ts`, which this spec deletes — **implementing this spec against `develop` without also deleting this file produces a compile error**, not a soft gap. Flagged here explicitly so the implementation plan includes it. |

**Response contract for `POST /api/signup`** (an earlier draft specified
none beyond the conflict shape):

| Outcome | Status | Body |
|---|---|---|
| New signup accepted | `200` | `{ "status": "success" }` |
| Replay of an existing `clientSubmissionId` (matching digest) | `200` | `{ "status": "success" }` — identical to a fresh success; a retrying client can't tell the difference, which is correct, since from its perspective there isn't one. |
| `clientSubmissionId` reused with a different payload | `409` | `{ "status": "conflict" }` — no other fields. |
| Rate limit exceeded | `429` | `{ "status": "error" }` — generic, no distinguishing detail (matches the existing "no field-name/status leaks" policy already established for this route). |
| Validation failure (empty/over-length name, empty/over-length city, over-length phone, malformed `clientSubmissionId`) | `400` | `{ "status": "error" }` |
| Honeypot tripped | `200` | `{ "status": "success" }` — see "Abuse controls" above; must be indistinguishable from a real success. |
| Untrustworthy/missing client IP (see "Client IP trust model") | `400` or `429` (implementation-time pick, both are already "generic client-facing failure" in this table) | `{ "status": "error" }` |

`lib/proxy.ts` is deleted. `MANAGEMENT_APP_BASE_URL`, `PUBLIC_PROXY_SECRET`,
and `NEXT_PUBLIC_GENERIC_JOIN_CODE` env vars are dropped entirely — nothing
left that uses any of the three (an earlier draft's removal list named only
the first two; the third was only mentioned in prose elsewhere in this
document, not in this checkable list — now all three are here together).

## Relationship to existing `/join` work

**What carries forward from `docs/features/join-form/spec.md`, narrowly:**
the field-level decisions that are about the *values themselves*, not
about link/entry-point mechanics — name/phone/city mandatory,
the trim-and-validate rule, `maxLength` parity (now validated against this
app's own schema limits instead of mirroring `corporations`'), and the
`clientSubmissionId` **generation/rotation** rules (reuse-on-ambiguous-
failure, fresh-on-definitive-response, fresh-on-edit-after-failure) as
designed and implemented on `develop` in `app/join/SignupForm.tsx` (see
the branch-state note under "Decision" above — not on `main`).

**What does not carry forward — broader than just the wire contract.** An
earlier draft of this spec understated this as only "`cityId`/`linkCode`
change." In fact, everything in `docs/features/join-form/spec.md` and its
`expected-result.md` that's about **entry points and link validity** is
also superseded, not just the request body shape:

- The `/join` vs `/join/[code]` entry-point distinction (join-form
  spec.md "Entry points") — gone; one entry point, `/join`.
  `NEXT_PUBLIC_GENERIC_JOIN_CODE` is no longer read anywhere.
- The "mount gate" (`/join`'s server-side check that skips mounting
  `SignupForm` when the env var is empty) — gone; `/join` always mounts
  the form directly.
- The entire `loading`/`inactive` client states and the link-check
  `useEffect` that produces them — gone. `SignupForm` no longer performs
  any check-before-render; it starts directly in a form-ready state.
- Every `expected-result.md` bullet keyed to those states or to
  `linkCode` (e.g. "an invalid/deactivated link and a transient network
  failure both show `inactive`") is moot — there is no link to be
  invalid.
- `cityId` (a `corporations`-City-table foreign key, looked up
  server-side to resolve a name) is replaced by `cityName`: the client
  sends the selected city string directly, since there's no foreign key
  left to resolve against — one field, no id/name split.
- Scenario 8's reasoning ("any `response.ok` is success, body unchecked,
  because the proxy is a transparent passthrough with no body-shape
  contract of its own") is now **false**, not just superseded — this app
  owns the endpoint and this spec defines a real response contract (see
  "API routes" above), so scenario 8's decision needs revisiting, not just
  archiving.
- Scenario 6 (city-list fetch failure handling) is moot the moment the
  city list is static data with no fetch at all — nothing to fail.

**What replaces the removed `loading`/`inactive` UI:** the form is visible
immediately on render — no loading screen, no network check before the
user can start typing. This is an accepted behavior change, not an
oversight: a backend outage is now discovered only at submit time (the
existing generic submit-error message, see below), not before the user
starts filling the form. If that tradeoff proves wrong in practice, adding
a loading state back is straightforward — not designed here since nothing
yet indicates it's needed.

**Error copy for the new failure modes (409/429/400/honeypot):** all
reuse the existing generic inline error message ("אירעה שגיאה. נסו שוב
בעוד רגע.") already shown for any submit-time failure — consistent with
scenario 7's already-decided "no field-name/status leaks" policy. No new
user-facing copy is introduced by this spec; a 409 (which, per the
lifecycle design above, a spec-compliant client should never actually
trigger) shows the same message as any other failure, not a special one.

The `!response.ok` / success / `catch` branches in `handleSubmit` stay
structurally similar (that control flow is about *this app's own*
request/response handling, not about `corporations`), but the endpoint
URL and body shape change, and — per the branch-state note — the version
of this function on `main` today also still contains leftover
volunteer-interest code (`declarationToken`, `INTEREST_OPTIONS`,
`handleInterest`) that must not be carried into the new implementation;
the `develop` version already has it removed.

**This means `app/join/SignupForm.tsx` needs another implementation pass**
once this spec is approved — not a full rewrite, but real changes: delete
the link-check `useEffect` and the `loading`/`inactive` states entirely,
change the request body (`cityName` not `cityId`, no `linkCode`), point
at the new endpoint, and build from `develop`'s state (not `main`'s). That
pass is a separate implementation plan from this spec, scoped after this
document is approved.

**The existing Vitest suite on `develop` needs the same treatment, not
just the component.** `app/join/__tests__/test-utils.tsx` and all five
test files under `app/join/__tests__/` are built entirely around the
architecture this spec removes — `renderFormReady()` mocks and waits on
`/api/proxy/support-links/test-code` and `/api/proxy/cities`, which stop
existing. Every existing test breaks under this change, not just the
ones about city/link behavior specifically — this needs its own
rewrite pass (new mocks for `/api/signup`, no more link-check wait), not
a silent expectation that "most tests still pass." Scoped as part of the
same follow-up implementation plan as the component itself, not a
separate afterthought.

## Data handoff to `corporations` — explicitly out of scope for v1

Signups accumulate in this app's own `SupportSignup` table with no
automatic path back to `corporations`' `Voter` table. A CSV export, a
periodic sync job, or a manual review page are all reasonable v2 options
— none is designed here. This is a deliberate scope cut, not a gap:
launching a working standalone signup form does not require solving
"how does the campaign act on these leads" on day one.

## Infrastructure

- New Postgres service in the **same Railway project** (`rbac_proj`,
  alongside `corporations`' services) — not a fully separate Railway
  project. Chosen over full project separation for lower
  operational/billing overhead. **Corrected framing from an earlier
  draft:** this has no data-sharing or credential-sharing relationship
  with `corporations`' own Postgres at the database level, but it is
  **not** blast-radius-neutral the way an earlier draft implied — a
  compromised Railway account, team member, or an over-broad deployment
  token reaches every service in the project, this one included,
  regardless of database isolation. That's an accepted, pre-existing
  exposure this decision doesn't newly create (the two services already
  shared a project before this spec), but it should be named as a real
  factor, not waved away with "same-project ≠ shared data" — that framing
  is only true for the data plane, not the account/access plane.
- This app gains a real `DATABASE_URL` for the first time. Prisma,
  matching `corporations`' own convention (consistency, not a hard
  requirement).
- **Both `coorporation-landing` (prod) and `coorporation-landing-dev`
  (dev) get their own Postgres *instance*, full stop — not a shared
  instance with separate logical databases.** An earlier draft offered
  the shared-instance-with-separate-databases option as an equally valid
  "implementation-time choice." It isn't: a shared instance means a
  single Postgres role/credential boundary away from dev traffic touching
  prod data (or vice versa) — a real isolation *boundary* is required
  here, not a naming *convention* that happens to keep them apart today.
  This is the one infrastructure point in this section that's
  architectural, not implementation-time.

## Open items for the implementation plan (not blocking this spec)

- Exact static city list contents.
- New route naming/paths (`/api/signup` used above as a placeholder).
- Rate-limit threshold and window-bucket width (mirrors the same "not
  before first real event" deferral the old spec already used) — the
  *mechanism* (atomic upsert into `SignupRateLimitBucket`, checked before
  any write) is now fully decided; only the numbers are deferred.
- Exact `X-Forwarded-For` position to trust, verified against Railway's
  actual current edge behavior (see "Client IP trust model") — the
  *policy* (trust the proxy-appended entry, fail closed if undeterminable)
  is decided; the concrete header-parsing implementation needs that
  verification before being trusted for something rate-limit-bearing.
- The `SignupForm.tsx` client-side implementation pass described above —
  its own plan, after this spec is approved, built from `develop`.
- Digest normalization details for `payloadDigest` (exact field ordering/
  encoding before hashing) — implementation-time, not architectural, as
  long as it's deterministic for identical input.
- Whether `/join/[code]`'s Next.js route file is deleted outright or left
  as a dead route returning 404 via the normal app-router "no match"
  behavior once `page.tsx` there is removed — trivial either way.
