# Standalone Signup Backend — Expected Result

Acceptance criteria for the design in `spec.md`. Extracted from its "Data
model," "Idempotency and rate limiting," "Client IP trust model,"
"Abuse controls," "Validation," and "API routes" sections and restated as
pass/fail checks.

## Independence from `corporations`

- No code path in this app calls `corporations`/the management app, at
  build time or runtime. `lib/proxy.ts`, `MANAGEMENT_APP_BASE_URL`,
  `PUBLIC_PROXY_SECRET` do not exist in the codebase.
- The app has a real `DATABASE_URL` pointing at its own dedicated
  Postgres, distinct from `corporations`' Postgres (different service,
  same Railway project is fine per spec — but never the same database or
  connection string).
- Dev and prod (`coorporation-landing-dev` / `coorporation-landing`) each
  have their own Postgres **instance** — not a shared instance with two
  logical databases. Confirmed by checking the two services' `DATABASE_URL`
  values resolve to different Postgres services in Railway, not just
  different database names on the same one.
- A signup submitted on dev never appears in prod's table or vice versa.

## Entry point

- `/join` always renders the signup form immediately — no loading state
  tied to a network check, no `inactive` state, no link-code concept
  anywhere in the URL or request.
- `/join/[code]` does not exist as a route (404, or removed entirely —
  either is acceptable per spec's own "Open items").

## Fields (server-side, independent of client validation)

- Submitting with an empty (or whitespace-only, after trim) `fullName`
  is rejected server-side, not just blocked client-side — confirm by
  bypassing the client (direct API call) with a whitespace-only name and
  observing a rejection.
- `fullName` over 200 chars is rejected server-side (not silently
  truncated).
- `phone` empty is rejected server-side; over 30 chars is rejected.
- `cityName` blank, missing, or whitespace-only is rejected
  server-side (city is mandatory). An over-length city (>100 chars)
  is rejected rather than truncated.
- `cityName` is never validated against the static city list — an
  arbitrary string is accepted and stored as-is (matches the established
  free-text policy).

## Idempotency

- Submitting the same `clientSubmissionId` twice with the **same**
  payload creates exactly one row — the second call returns the first
  call's result, not an error, not a duplicate row.
- Submitting the same `clientSubmissionId` twice with a **different**
  payload (e.g. a different phone number) is rejected as a conflict —
  the second call does not silently return the first call's data, and
  does not create a second row either.
- The conflict response does not disclose the original submission's
  `fullName`/`phone`/`cityName` to the second caller.
- A malformed (non-UUID) `clientSubmissionId` is rejected before any
  idempotency or rate-limit logic runs.
- A genuine replay (same id, same payload) is never blocked by the rate
  limiter, even if that IP is currently at its rate-limit cap — replay
  detection runs first.

## Rate limiting

- Repeated distinct submissions (different `clientSubmissionId`,
  different payloads) from the same IP within the configured window are
  rejected (`429`) once the threshold is hit.
- **A rate-limited (429) submission never creates a `SupportSignup` row** —
  a direct DB check after a rejected burst shows the row count matching
  the configured threshold, not the number of requests sent. (This is the
  specific bug an earlier design draft had and this criterion exists to
  catch a regression back to it.)
- `SignupRateLimitBucket`'s count for that `(ip, windowStart)` reflects
  every genuinely-new attempt, including honeypot-tripped and
  ultimately-429'd ones — only replays (Step 1 of the write path) are
  excluded from incrementing it.
- Concurrent requests fired simultaneously from the same IP do not exceed
  the configured cap — the atomic upsert design means this is an exact
  boundary, not a best-effort one; a test firing N+1 concurrent requests
  against a cap of N should see exactly N succeed (or reach Step 3) and
  the rest rejected, not N+something.
- A genuine replay (same id, same payload) is never blocked by the rate
  limiter, even if that IP is currently at its cap — confirmed by
  checking replay detection (Step 1) runs and returns success before the
  rate-limit bucket is ever touched.

## Honeypot

- A submission with the honeypot field filled in and non-empty (after
  trim) is stored with `honeypotTripped = true` — not silently dropped,
  and not exempt from the idempotency/rate-limit checks above.
- The response to a honeypot-tripped submission is byte-for-byte
  identical to a real success response (`200`, `{ "status": "success" }`)
  — no field, header, or timing difference a scripted client could use to
  learn it was caught.
- A honeypot field that's present but empty/whitespace-only, or entirely
  absent from the request, is **not** treated as tripped.

## Response contract

- A new, valid signup returns `200` with `{ "status": "success" }`.
- A replay (same `clientSubmissionId`, same payload) returns `200` with
  the identical body a fresh success would — a client cannot distinguish
  "this was new" from "this was a safe replay" from the response alone.
- `clientSubmissionId` reused with a genuinely different payload returns
  `409` with a body containing no `fullName`/`phone`/`cityName` field —
  confirmed by inspecting the raw response body, not just the status code.
- Any validation failure, rate-limit rejection, or untrustworthy-IP
  rejection returns a generic `{ "status": "error" }` body with no
  field-specific detail, regardless of which check actually failed —
  confirmed by triggering each failure mode and diffing the response
  bodies (they should be indistinguishable from each other beyond the
  status code, per policy).

## Client IP handling

- A request with a spoofable client-supplied `X-Forwarded-For` value does
  not let the sender control their own rate-limit bucket — confirmed by
  sending two requests with different attacker-supplied leading
  `X-Forwarded-For` entries but the same real connection, and observing
  they land in the *same* bucket (proving the trusted position is the
  proxy-appended one, not the client-supplied one).
- A request where no trustworthy IP can be determined is rejected
  (fail-closed), never silently bucketed under a shared `"unknown"` key.

## Data handoff

- No feature in this app exports, syncs, or otherwise transmits
  `SupportSignup` rows to `corporations` — confirmed absent, not just
  unused (v1 scope cut, not a gap to silently fill in).
