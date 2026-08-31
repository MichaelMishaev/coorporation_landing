# Supporter Self-Signup — Expected Result

Acceptance criteria for the backend/architecture design in `spec.md`. Extracted
from that document's own "Testing" section (the contracts it names as
mattering most) and restated as pass/fail checks, not test code.

**Note:** the volunteer-interest yes/maybe/no follow-up step described
elsewhere in `spec.md` was fully removed after that document was written —
see `docs/features/join-form/spec.md` scenario 5. It is **not** part of
expected behavior and has no criteria below.

**Superseded (2026-08-31):** every criterion below assumes the old
proxy-to-`corporations` architecture (`Voter`, `OfflineMutationReceipt`,
`SupportLink`, `X-Public-Proxy-Secret`, Redis-backed rate limiting). That
architecture is replaced — see `docs/features/standalone-signup/spec.md`.
None of the criteria below are current acceptance criteria; kept as
historical record only, matching `spec.md`'s own "Superseded" errata.

## Must be true

- **City handling never runs through scoped resolution.** A link owned by a
  `CITY_COORDINATOR` scoped to one city, used by a supporter who selects a
  *different* city, still creates a `Voter` owned by the link owner — no
  error, no conflict record, no rejection based on the mismatch.
- **Consent and support level are actually persisted.** `consentStatus` is
  `GRANTED` and `supportLevel` is set on the created `Voter` — not silently
  dropped by `voterLawfulBasisSchema`.
- **Idempotency holds under retry and concurrency.** Submitting the same
  `clientSubmissionId` twice — including concurrently — creates exactly one
  `Voter` row and exactly one `OfflineMutationReceipt`. No duplicate on
  replay.
- **A deactivated link owner stops producing new voters.** If the link
  owner's `isActive` flips false (or the owner no longer holds the
  role/profile the link was created for), the link stops creating `Voter`
  rows — a generic failure, not an internal error that leaks why.
- **Rate limiting fails closed on this route specifically**, independent of
  the app-wide default. If the Redis-backed limiter is unavailable, this
  unauthenticated write path rejects rather than admitting unlimited
  traffic — verified independently of `lib/ratelimit.ts`'s normal
  fail-open behavior (correct everywhere else, wrong here).
- **A missing or invalid shared secret gets a generic 404** on every
  `/api/public/*` route, before any rate-limit or business logic runs — not
  a 401/403 that would confirm the route exists to an unauthenticated
  prober.
- **Per-IP rate limiting keys on the forwarded real IP, not the proxy's
  connection IP.** Two different `X-Original-Client-IP` values arriving
  through the same proxy connection are limited independently; the same
  value forwarded by different proxy instances is limited jointly.
- **No cross-tenant/RBAC leak.** The public route cannot be used to read or
  infer any other user's or voter's existing data. Link-code enumeration
  reveals only "this code is valid or invalid" — nothing about which
  internal users or links exist beyond that.

## Explicitly not required (see `spec.md`'s "Non-goals")

Real-time phone dedup/merge, SMS/WhatsApp delivery, CAPTCHA, an
analytics dashboard beyond what existing `Voter`/`Task` screens already
provide, and (as of the removal noted above) any volunteer-interest
follow-up at all.
