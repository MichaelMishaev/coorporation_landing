# `/join` Signup Form — Expected Result

Acceptance criteria for the field-level spec in `spec.md`. Extracted from
that document's "Field requirements," "City handling," and "Scenarios —
decided" sections and restated as pass/fail checks.

**Partially superseded (2026-08-31):** the "Fields" and "Submission
behavior" sections below (values, validation, idempotency-key lifecycle)
are still current, **except city**: as of 2026-09-01 city is mandatory
and cannot be left blank. The "Entry points" section and every bullet mentioning
`inactive`, the mount gate, or `NEXT_PUBLIC_GENERIC_JOIN_CODE` are not —
see `docs/features/standalone-signup/spec.md`.

## Fields

- Name and phone cannot be submitted empty — enforced both client- and
  server-side.
- A whitespace-only name (`"   "`) is rejected **before** any network
  request — trimmed and locally validated, with a specific inline error,
  not a round-trip to the server.
- City can be left blank and the submission still succeeds.
- Leaving city blank sends **no `cityId` key at all** in the request body —
  never `cityId: ""`. (Sending an empty string would fail the server's
  `.min(1)` check and reject the entire submission, not just the city.)
- The city `<select>`'s blank option is selectable at any time, including
  after a city was previously chosen — a supporter can change their mind
  back to "no city."
- The city field's label visibly marks it as optional; the blank option's
  label reads as a real "no city" choice, not a leftover placeholder
  instruction.
- Name and phone inputs enforce the same max lengths as the server schema
  (200 / 30 chars) — an over-limit value cannot even be typed, not just
  rejected after submit.

## Entry points

- `/join` with `NEXT_PUBLIC_GENERIC_JOIN_CODE` unset never mounts the form
  — shows a static inactive message before any fetch happens.
- `/join` with the env var set, and `/join/[code]` with any code, both
  mount the form and validate the link client-side after mount.

## Submission behavior

- **Retry safety without a duplicate-voter risk:** a retry after an
  *ambiguous* failure (the request itself failed — no server response,
  e.g. a network drop) with an *unchanged* payload reuses the same
  idempotency key.
- **No conflict-loop trap:** a retry after a *definitive* server response
  (any HTTP response, ok or not) gets a fresh idempotency key — so
  correcting a field after a validation error and resubmitting works,
  rather than permanently hitting a 409 under the stale key.
- Any field edit after a failed attempt is treated as a new attempt (fresh
  key), regardless of which failure mode preceded it.
- No client-side request timeout/`AbortController` — a hung request stays
  `submitting` rather than firing a premature, ambiguous "failure" while
  the write may still be in flight server-side.
- A truly invalid/deactivated link and a transient network failure on the
  initial link check both show the same `inactive` state — intentional,
  not a defect to fix.
- Every submit-time failure (validation, rate limit, inactive link,
  upstream error) shows the same generic retry message — intentional, no
  field-name or status-specific leak.
- Any `response.ok` from the submit call is treated as success without
  parsing the body — intentional, matches how the proxy layer treats every
  other call.
- An empty or failed city list does not block submission — city stays
  skippable either way.

## Known, accepted external dependency

Local `/join` (generic link) stays inactive until `corporations` seeds a
real generic `SupportLink` and this repo's env config gets a real
`NEXT_PUBLIC_GENERIC_JOIN_CODE` — not a failure of anything in this
checklist.
