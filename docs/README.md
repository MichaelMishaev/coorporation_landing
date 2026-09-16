# Docs Index

This app (the public landing page + supporter self-signup flow for עמך ישראל)
was designed and scoped in the `corporations` repo (the private election
management app this app talks to). These documents are copied here so this
repo is self-contained and doesn't require access to that repo to understand
what it's building toward.

## Structure

Each feature lives in its own folder under `docs/features/<feature>/`, with
two files:

- **`spec.md`** — the requirements/design document: what the feature is,
  why, and the decisions behind it.
- **`expected-result.md`** — concrete pass/fail acceptance criteria for that
  spec, extracted from it. What must actually be true for the feature to be
  considered correctly built, separate from the reasoning behind it.

## Features, in reading order

1. **`features/standalone-signup/`** — **current architecture** for the
   signup backend, as of 2026-08-31. This app is standalone: its own
   database, its own signup-storage logic, no runtime dependency on the
   `corporations` repo/service. Read this first for how `/join` actually
   works today.
2. **`features/supporter-self-signup/`** — **superseded.** The original
   backend/architecture spec (same-origin proxy to `corporations`'
   `/api/public/*`, `SupportLink` codes, attribution to `corporations`'
   `User` records). Kept as historical record — see its own "Superseded"
   errata at the top. Its volunteer-interest section was also separately
   removed earlier (see `features/join-form/spec.md` scenario 5).
3. **`features/join-form/`** — the `/join` form's field-level requirements
   and scenario decisions (name/phone/city mandatory,
   idempotency-key lifecycle, validation UX). **Correction:** these
   decisions hold only narrowly under the new standalone architecture —
   the field *values* (name/phone/city rules, the idempotency-key
   generation/rotation rules) carry forward, but everything about entry
   points and link validity (the `/join`/`/join/[code]` split, the mount
   gate, the `loading`/`inactive` states) is also superseded, not just the
   wire contract — see `features/standalone-signup/spec.md` "Relationship
   to existing `/join` work" for the precise breakdown.
   `app/join/SignupForm.tsx` (and its Vitest test suite) needs a follow-up
   implementation pass to match.
4. **`features/landing-page/`** — the design spec for what this repo
   actually renders: tokens, section-by-section content, the CTA routing
   decision, asset inventory. **Mostly unaffected** — only §4's CTA-routing
   mechanism (generic `SupportLink` code, `NEXT_PUBLIC_GENERIC_JOIN_CODE`)
   is superseded; see that spec's own errata note, not "unaffected"
   outright.

The original product brief (`Supporter_Acquisition_Module_PRD.md`) was
removed 2026-08-31 — it described a heavier multi-tenant SaaS design
(assignment queues, activist-candidate SLAs, referral links, a separate
supporter database, WhatsApp/OTP automation) that was deliberately never
built. Nearly everything in it was superseded by the two feature specs
above; nothing in this repo references it anymore.

## Current status (2026-08-31)

**Architecture decision (2026-08-31):** this app is going standalone — see
`features/standalone-signup/spec.md`. Reason: `corporations`' `/api/public/*`
routes were independently verified unavailable on both its `dev`
(`test.rbac.shop`) and `prod` (`app.rbac.shop`) backends, and the decision
was made to stop depending on that backend permanently, not just to work
around the current gap. As of this date, the standalone backend
(new Postgres, new routes, `SignupForm.tsx` wire-contract update) is
**implemented and committed** on branch `standalone-signup-backend`
(code complete, task-reviewed and whole-branch-reviewed by two
independent reviewers) — **not yet merged into `develop` and not yet
live**. `/join` in currently deployed code (both dev and prod) still
runs on the old proxy architecture until this branch merges and deploys.

**Built and deployed** (this repo, old architecture): the full landing page,
`/join` + `/join/[code]`, and the four `/api/proxy/*` passthrough routes.
Live at `https://coorporation-landing-production.up.railway.app` (prod) and
`https://coorporation-landing-dev-development.up.railway.app` (dev). See
this repo's own `README.md` for what was intentionally simplified in v1
(mobile nav, the optional benefit-grid section, favicon/OG crop, `/privacy`
and `/accessibility` placeholder content). Team-member name/role captions
shipped (the lineup section now renders 11 named candidates individually,
not the original single composite photo) — no longer part of this list.

**Field-level fixes shipped to `develop`/dev (2026-08-31):** city was
optional (wire contract + UI); as of 2026-09-01 city is mandatory.
Name trim/validation, `maxLength` parity, and the
`clientSubmissionId` idempotency-key lifecycle — see
`features/join-form/spec.md` and its `expected-result.md`. These went in
against the *old* proxy architecture. These were adapted to the new wire
contract as part of the standalone backend's implementation (Task 7 of the
standalone-signup-backend plan) — carried forward unchanged in logic, just
pointed at the new endpoint and request shape. Not yet live until that
branch merges and deploys.

**Superseded, not applicable to new work:** the "Not yet built" /
`NEXT_PUBLIC_GENERIC_JOIN_CODE` / `PUBLIC_PROXY_SECRET` blockers that used
to be listed here only applied to the old `corporations`-dependent
architecture. Under the new standalone design, none of them are relevant —
see `features/standalone-signup/spec.md`'s own "Open items" instead.
