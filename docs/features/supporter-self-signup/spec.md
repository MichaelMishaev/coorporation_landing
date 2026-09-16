# Supporter Self-Signup ("Lead Machine")

**Date:** 2026-08-26
**Status:** Approved design, pending implementation plan
**Lane:** CRITICAL — new unauthenticated write path into the `Voter` table, plus attribution/RBAC-adjacent logic (CLAUDE.md rule 2.1). RED contract tests + fresh-context adversarial review required before landing, even though the feature itself is small.

**Errata (2026-08-31):** the volunteer-interest step described throughout this
document (decision 6 below, the `.../interest` proxy route, the
"Volunteer-interest step" data-model section, `declarationToken`, and the
matching testing contract) was **fully removed** after this spec was
approved — no longer built, no longer planned. Every mention of it below is
kept as historical record of a decision that was later reversed, marked
inline where it appears, not current behavior. See
`docs/features/join-form/spec.md` scenario 5.

**Superseded (2026-08-31):** this document's entire architecture — the
same-origin proxy to `corporations`' `/api/public/*`, `SupportLink` codes,
attribution to `corporations`' `User` records, this app holding no DB
credentials of its own — is **replaced** by a permanent decision to make
`coorporationLanding` standalone (its own database, no runtime dependency
on `corporations`). See `docs/features/standalone-signup/spec.md` for the
new architecture and the reasoning. This document is kept in full as
historical record of the original design, not as current or planned
behavior.

## Origin and scope cut

A full PRD exists at `docs/features/leadMachine/reference/Supporter_Acquisition_Module_PRD.md`. It is written for a multi-tenant SaaS and is far heavier than what this platform needs or than this codebase's architecture supports. This spec deliberately implements a small subset, decided in conversation with the product owner:

1. Public form collects only **name, phone, city** (city picked from the existing `City` list).
2. Signups write **directly into the existing `Voter` table** — no separate supporter/staging database.
3. Any user with role `ACTIVIST`, `ACTIVIST_COORDINATOR`, `CITY_COORDINATOR`, or `AREA_MANAGER` can generate **one personal link** (`SUPERADMIN` excluded — created via seed only, not meant to recruit publicly).
4. **Ownership always follows the link**, even if the supporter's chosen city doesn't match the link owner's own scope. There is no assignment-conflict queue and no geographic-recommendation engine.
5. **One generic link**, owned by a fixed "Campaign HQ" `User` account, for non-personal sharing (ads, general posts).
6. ~~After the core submission, the form asks a yes/maybe/no volunteer-interest question. Yes/maybe creates a `Task`/`TaskAssignment` (reusing the existing broadcast model) directed at the link owner.~~ **Removed 2026-08-31** — see errata above.
7. **The public landing/signup surface is a separate, lightweight Next.js app on its own domain** — the election-management app stays fully private/internal on its own domain and is never itself reachable from the public internet's browser traffic. The public app calls the management app's `/api/public/*` routes over HTTPS; it never talks to Postgres directly. See "Deployment topology."

Explicitly dropped from the source PRD: `campaign_id`/tenant model (this app is single-tenant, scoped by `city_id`/area only), a second supporter database, the assignment/conflict-resolution queue, per-channel consent granularity, WhatsApp API automation, phone OTP verification, supporter-to-supporter referral links, activist-candidate status machine with SLAs. Any of these can become their own follow-up spec once this MVP is live.

## Goals

- A supporter can declare support in under a minute, in Hebrew/RTL, with no login.
- Every eligible internal user can generate a personal link + QR from their own account; the generic link covers everyone else.
- One shared, `UserContext`-driven code path creates the `Voter` row — the public route does **not** get a second, diverging creation implementation.
- The flow is resistant enough to scripted abuse that it can't flood the real, production-visible voter list faster than a human can react, given that the only existing cleanup tool (SuperAdmin bulk-duplicate-archive) is phone-keyed and manually triggered.

## Non-goals

Everything listed as "explicitly dropped" above, plus: SMS/WhatsApp thank-you delivery (may reuse existing comms integrations later, out of scope here), CAPTCHA (honeypot + rate limiting only for this MVP), analytics dashboards beyond what the existing `Voter`/`Task` screens already provide.

## Prior art already in this codebase

Confirmed by reading the code, not assumed:

- `Voter.phone` is **explicitly not unique** — schema comment: "duplicates allowed." Dedup is a periodic, reversible, SuperAdmin-only soft-delete cleanup (`lib/voters/core/duplicate-identity.ts`, built after a real 2026-08-09 production incident), not a write-time block. This MVP does not add new real-time identity-merge logic — it relies on the same tolerance, with tighter abuse controls than internal entry ever needed (see "Abuse controls").
- `Voter.dataSource` already has an unused `VoterDataSource.SELF_REPORTED` enum value, alongside `DIRECT_CONTACT`/`LEGACY_IMPORT`. This feature is what it was clearly added for.
- `Voter.insertedByUserId`/`insertedByUserName`/`insertedByUserRole` (who created the row) and `assignedActivistId`/`assignedActivistName` (who currently owns follow-up) already exist as separate concepts. No new attribution table is needed — a personal link's owner becomes `insertedByUserId` (and `assignedActivistId` when the owner is an `ACTIVIST`).
- `lib/voters/visibility/rules.ts` already has a `DirectInserterVisibilityRule` — the inserter can always see their own voters — plus role-scoped rules for `CITY_COORDINATOR`/`AREA_MANAGER`/`SUPERADMIN`. "The voter belongs under him" (decision 3/4 above) therefore requires no new visibility logic.
- The **in-flight ACTIVIST Excel-import path** (`app/app/actions/voters.ts`, uncommitted as of 2026-08-09 per `docs/superpowers/specs/2026-08-09-voter-import-durable-job-design.md`) already establishes the exact precedent this feature needs: for `ACTIVIST`, canonical city resolution is bypassed entirely and the caller's own scope (`viewer.cityId`) is the sole authority, with the free-text city stored but never validated against it. This spec generalizes that same bypass to all four eligible roles for the public path (see "City handling").
- `Invitation` is the existing pattern for a public unique token/code with an owner and expiry — the model for `SupportLink` below.
- `OfflineMutationReceipt` already solves "durable, replay-safe idempotency for a CREATE_VOTER-shaped mutation" with an HMAC digest, an actor FK, and a 30-day expiry. This is reused for idempotency instead of inventing a new mechanism.
- ~~`Task`/`TaskAssignment` is an existing sender→recipients broadcast model (`status`: unread/read/acknowledged/archived). Reused as-is for the volunteer-interest follow-up notification — no new task/SLA model.~~ **Removed 2026-08-31** — the volunteer-interest step that would have used this was cut; see errata above.
- `lib/ratelimit.ts` is Redis-backed and already used elsewhere, but **fails open** on Redis errors ("availability over strict security" — acceptable when every existing caller is already authenticated). This route needs different behavior (see "Abuse controls").

## Architecture

Two Railway services in the same Railway project, sharing one Postgres/Redis. No new database, no second `Voter` store.

1. **Existing management app** (`app/`) — unchanged domain, unchanged auth boundary. Gains the `/api/public/*` routes (below), reachable only from the public app's server (see "Same-origin proxy" — supersedes the CORS-only approach originally in this section).
2. **New public app** (new top-level `public-landing/` directory in this repo) — its own `package.json`, Dockerfile/nixpacks, Railway service, and custom domain (e.g. `join.<party-domain>`). No Prisma client, no DB credentials, no session/auth code at all — it is a pure Hebrew/RTL frontend that renders campaign branding. Kept deliberately thin so it stays fast (PRD §21.1's "avoid loading the authenticated bundle" is satisfied for free — there is no authenticated bundle in this app to load) and so a deploy of the landing page's copy/branding never touches the RBAC-critical codebase. It gains one thing beyond static rendering: a small server-side proxy (below) so the browser never calls the management app directly.

```
Public browser     Public app: browser-facing pages   Public app: server-side proxy    Management app: /api/public/*      Postgres / Redis
     |                          |                                  |                              |                              |
     |-- GET /join/{code} ---->|                                  |                              |                              |
     |                          |-- (same server) GET /api/proxy/support-links/{code} ----------->|                              |
     |                          |                                  |-- GET .../support-links/{code}, X-Public-Proxy-Secret ------->|
     |                          |                                  |                              |-- resolve SupportLink -------->|
     |<-- landing + form -------|<---------------------------------|<-- { campaignName, logo, ... }|                              |
     |                          |                                  |                              |                              |
     |-- submit form ---------->|                                  |                              |                              |
     |                          |-- (same server) POST /api/proxy/support-signup {name, phone,     |                              |
     |                          |     cityId, linkCode, clientSubmissionId, honeypot} ------------>|                              |
     |                          |                                  |-- POST .../support-signup, X-Public-Proxy-Secret,             |
     |                          |                                  |     X-Original-Client-IP: <real browser IP> ----------------->|
     |                          |                                  |                              |-- verify secret; rate-limit check
     |                          |                                  |                              |     (per link + X-Original-Client-IP, fail-closed) -->|
     |                          |                                  |                              |-- resolve link -> owner User (must be isActive) ->|
     |                          |                                  |                              |-- synthesize UserContext for owner                |
     |                          |                                  |                              |-- createVoterForContext(input, ownerContext) ---->|
     |                          |                                  |                              |     (OfflineMutationReceipt idempotency check)   |
     |<-- thank-you ------------|<---------------------------------|<-----------------------------|                              |
```

(The volunteer-answer / `.../interest` / `declarationToken` leg shown in an
earlier version of this diagram was removed 2026-08-31 — see errata above.
The flow now ends at the thank-you screen immediately after signup.)

### Same-origin proxy (browser never calls the management app)

A design review of the companion landing-page spec (`docs/features/leadMachine/2026-08-26-landing-page-design-spec.md` §7) surfaced a real gap in the original CORS-only approach: CORS restricts what a *browser* can read cross-origin, not what a browser can *see*. With the browser calling the management app's `/api/public/*` directly, that domain is visible in the network panel and in DNS/CT logs to anyone who opens devtools — which undermines the "the management app is never publicly reachable-looking" goal, even though CORS was correctly never claimed to be an abuse defense (see below).

**Fix: every browser-facing request stays same-origin against the public app. The public app's own server proxies to the management app.**

- New routes on the public app's own server: `POST /api/proxy/support-signup`, `GET /api/proxy/support-links/{code}` — thin pass-throughs with no business logic. The browser only ever talks to these. (A third route, `POST /api/proxy/support-signup/{id}/interest`, existed for the volunteer-interest step; removed 2026-08-31 along with that step — see errata above.)
- Each proxy call to the management app carries a **shared secret** header (`X-Public-Proxy-Secret`), set as a matching Railway env var on both services. The management app's `/api/public/*` routes reject any request missing or failing this check with a generic 404 — not a 401/403, so the routes' existence isn't confirmed to a prober that omits the header.
- **Real client IP must survive the hop, or the existing per-(link, IP) rate limiting silently collapses to per-link-only** — every request would otherwise arrive at the management app carrying the public app's own server IP, not the supporter's. The proxy reads the real client IP the same way `lib/ratelimit.ts` already does today (`x-forwarded-for`/`x-real-ip`, set by Railway's edge) and forwards it explicitly as `X-Original-Client-IP`. The management app's rate limiter keys on `X-Original-Client-IP` **only when `X-Public-Proxy-Secret` is valid**; without a valid secret, the request is rejected outright before any IP logic runs, so there's nothing for an unauthenticated caller to spoof.
- **Residual, accepted risk:** if the shared secret leaks, a caller could both bypass the "generic 404" gate and forge `X-Original-Client-IP` to defeat per-IP limiting. This is the standard exposure of any shared-secret pattern and isn't solved further here — the daily-cap-per-link control (see "Abuse controls") is IP-independent and stays as a backstop regardless.
- CORS on `/api/public/*` is now unnecessary for its original purpose (the browser never calls it) and is tightened to same-origin-only as pure defense in depth, not relied upon for anything.
- This changes nothing about `createVoterForContext`, `SupportLink`, `OfflineMutationReceipt`, or any abuse control below — the proxy is a transport-layer change, not a business-logic one.

### Deployment topology

- Both services live in this one repo/monorepo; Railway builds each from its own root directory (`app/` and `public-landing/`), same pattern already used for `app/` today (`nixpacks.toml` → `cd app && ...`) — a second `nixpacks.toml`/Dockerfile at `public-landing/` follows the same shape.
- The public app now needs exactly one secret beyond the management app's base URL: `PUBLIC_PROXY_SECRET`, matched on both services. Still no `DATABASE_URL`, no `NEXTAUTH_SECRET`, nothing that touches data directly — a compromise of the public app's server yields the ability to call the same public signup API a browser already could, nothing more.
- Rate limiting, the honeypot, and fail-closed Redis behavior (below) are unchanged and remain the actual abuse defense; the proxy closes the origin-visibility gap, it does not replace them.

## Core refactor: one shared creation path

`createVoter()` (`app/lib/voters/actions/voter-actions.ts:825`) currently opens with `const viewer = await getUserContext()`, which calls `auth()` internally and throws without a session. It cannot be called from an unauthenticated route as-is.

**Fix:** extract the body of `createVoter()` into `createVoterForContext(input: CreateVoterInput, viewer: UserContext)`. The existing `createVoter()` server action becomes a thin wrapper: `getUserContext()` then `createVoterForContext(input, viewer)`. The new public route builds its own `viewer: UserContext` for the link owner and calls the same extracted function — one creation path, not two.

Building the public path's `UserContext`: reuse the same DB lookup `getUserContext()` already does (`app/lib/voters/actions/context.ts:76-138`) against the link owner's `userId`, not the session. This also naturally re-validates the owner is `isActive` and still holds the role/profile the link was created for — a deactivated activist's stale QR code stops attributing new voters, matching how `getUserContext()` already fails closed for scoped roles with no active profile.

## City handling

Do **not** run the supporter's submitted city through the caller-scoped `resolveCanonicalCity()` path that `createVoter()` uses for `CITY_COORDINATOR`/`AREA_MANAGER` today — that path rejects out-of-scope cities, which would silently break decision 4 (ownership always follows the link) for exactly the case it's meant to allow.

Public-path rule, applied uniformly regardless of the link owner's role: store the supporter's selection as free-text `voterCity` (matching what the city list already provides), and set `insertedByCityName`/`insertedByNeighborhoodName` from the **link owner's own** profile — the same pattern the in-flight ACTIVIST import path already uses (store free text, never re-validate against a caller-scoped canonical city). This means the public path skips `resolveCanonicalCity()` for every role, not just `ACTIVIST`.

## Consent and support fields

- `consentStatus = ConsentStatus.GRANTED` — the supporter is submitting their own data and explicitly declaring support (the landing page's primary CTA per the PRD's UX language, e.g. "אני תומך/ת", is the explicit action; the form itself carries no pre-checked box). This is required because `voterLawfulBasisSchema` blocks setting `supportLevel` unless `consentStatus === GRANTED` — leaving this implicit would silently prevent coordinators from ever editing `supportLevel` on these rows later.
- `supportLevel = "תומך"` (existing free-text convention on `Voter`, matching the values already used elsewhere in the app).
- `dataSource = VoterDataSource.SELF_REPORTED`.
- Because there is no real-time dedup/merge (see "Prior art"), the response to the public form **never differs based on whether the phone already exists** — every valid submission creates a new `Voter` row. This is a deliberate simplification, not an oversight: it removes the entire "must not reveal existing phone" concern from the original PRD (§10.2) for free, at the cost of the abuse controls below being load-bearing.

## Data model

### `SupportLink` (new, modeled on `Invitation`)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `code` | string, `@unique` | Public short code, e.g. 8-char random base62. No sequential IDs in URLs. |
| `linkType` | string | `"personal"` \| `"generic"` |
| `ownerUserId` | FK → `User`, `onDelete: Restrict` | The recruiter (or the fixed Campaign HQ account for the generic link). |
| `active` | boolean, default `true` | Manager can deactivate without deleting history. |
| `createdAt` | timestamp | |
| `totalSignups` | int, default `0` | Denormalized counter, incremented per successful signup — cheap per-link flood visibility without a new analytics table. |
| `lastSignupAt` | timestamp, nullable | Same purpose. |

Indexes: `@@unique([code])`, `@@index([ownerUserId])`.

One active personal link per eligible user, enforced at the application level (find-or-create on "get my link"), not a DB constraint — volume doesn't justify the complexity.

### Idempotency: reuse `OfflineMutationReceipt`

The public route requires a client-generated `clientSubmissionId` (UUID). Before writing, look up `OfflineMutationReceipt` by `operationId = clientSubmissionId`:

- If found and `appliedAt` is set, return the prior result — no new `Voter` row, safe against double-click and network retries.
- If not found, create the receipt (`kind = CREATE_VOTER`, `actorUserId = <link owner>`, `requestDigest = HMAC(normalized payload)`) inside the same transaction as the `Voter` create, matching the existing offline-mutation pattern exactly.

This replaces the ad hoc short-lived Redis lock originally proposed — it is durable across Redis restarts/multi-instance deploys and leaves an audit trail, at no extra modeling cost since the table already exists for this exact shape of problem.

### Audit log

`voter-actions.ts` currently hardcodes `importSource: 'manual'` on the `CREATE_VOTER` audit entry (`voter-actions.ts:895-906`), and does not record which link a voter came from. This path must record `importSource: 'public_signup'` and the `SupportLink.code` used, so a SuperAdmin can retroactively spot an abusive link (see "Abuse controls").

### Volunteer-interest step — removed 2026-08-31

~~No new table. On yes/maybe, create one `Task` (`senderUserId` = a fixed system/Campaign-HQ user) + one `TaskAssignment` (`targetUserId` = the link owner, or Campaign HQ itself for the generic link), body referencing the new voter's name/phone. The interest endpoint accepts a short-lived, stateless, server-HMAC-signed `declarationToken` (voter id + expiry, verified without a DB lookup) returned by the create-signup response — no new persisted secret table for this low-severity step.~~

This entire step (the yes/maybe/no question, the `Task`/`TaskAssignment`
creation, the `declarationToken`, and the `.../interest` route) was fully
removed after this spec was approved. Kept here as historical record only
— see errata at the top of this document.

## Abuse controls

The existing SuperAdmin bulk-duplicate-archive tool only catches **matching phones**. A script generating thousands of distinct, validly-shaped fake numbers (`validatePhoneFormat()` only checks `05\d{8}` shape) sails past it entirely and lands directly in the real, coordinator-visible voter list. This is the sharpest risk in the whole feature and gets concrete, not vague, controls:

- **Per-link-code AND per-IP rate limiting, combined** (neither alone is sufficient — Israeli mobile CGNAT means legitimate supporters can share one IP): default **5 submissions/minute per (link code, IP) pair**, plus a **daily cap per link** (default 200/day, configurable per link type — event links may need a higher temporary cap). Exact defaults are configuration, not hard-coded, so they can be tuned after the first real event without a deploy. Since the browser now reaches this route only through the public app's proxy ("Same-origin proxy" above), "IP" here means the value in `X-Original-Client-IP`, trusted only when `X-Public-Proxy-Secret` is valid — never the raw connection IP, which would always be the proxy's own.
- **This route fails closed**, not open, if the rate-limit backend isn't real Redis — the opposite of `lib/ratelimit.ts`'s existing default, which is correct everywhere else because every existing caller is already authenticated. An unauthenticated write path with no rate limiting at all if Redis hiccups is a materially different risk than today's callers accept.
- Honeypot field + submission-timing check (reject submissions faster than a human can plausibly fill the form) — no CAPTCHA in this MVP; flagged as an accepted gap, not solved.
- `SupportLink.totalSignups`/`lastSignupAt` plus the audit log's recorded link code give a SuperAdmin a cheap way to spot "link X produced 400 signups in an hour" without a new dashboard — a full analytics view is a "should have," not MVP.

## Permissions and locked screens

New capability, not a new permission-matrix concept: "generate/view my own SupportLink" is available to `ACTIVIST`/`ACTIVIST_COORDINATOR`/`CITY_COORDINATOR`/`AREA_MANAGER`, self-service only (a user gets their own link, not anyone else's) — no new entry in `PERMISSIONS_MATRIX.md` is needed since this doesn't grant visibility into any other user's or voter's data beyond what `DirectInserterVisibilityRule` already grants.

**The internal "get my link" UI touches existing dashboard screens, which are LOCKED per CLAUDE.md.** This spec covers the backend/API/data-model design; the exact placement of the "get my personal link + QR" control in the existing dashboard requires explicit user approval on the specific screen(s) before implementation, per the standing screen-lock rule — flagged here as a required approval step in the implementation plan, not resolved in this document.

## Testing

Per CLAUDE.md's CRITICAL lane: Codex-authored RED contract tests before implementation, via the `tdd-codex` skill. Contracts that matter most, given the risks surfaced during design review:

- Public path never runs the supporter's city through scoped `resolveCanonicalCity()` — a Netanya coordinator's link used by a Tel-Aviv supporter still creates a `Voter` owned by the Netanya coordinator, with no error and no conflict record.
- `consentStatus = GRANTED` is set and `supportLevel` is actually persisted (regression guard against `voterLawfulBasisSchema` silently no-op'ing it).
- Same `clientSubmissionId` submitted twice (including concurrently) creates exactly one `Voter` row and one `OfflineMutationReceipt`.
- A deactivated link owner's link stops creating new `Voter` rows (returns a generic failure, not an internal error leaking why).
- Rate limiter fails closed (rejects) for this route specifically when Redis is unavailable, verified independently of the app-wide fail-open default.
- `/api/public/*` rejects any request with a missing or invalid `X-Public-Proxy-Secret` with a generic 404 (not 401/403), before any rate-limit or business logic runs.
- Rate limiting keys on `X-Original-Client-IP`, not the raw connection IP — two different `X-Original-Client-IP` values through the same proxy connection are limited independently; the same `X-Original-Client-IP` value is limited jointly regardless of which proxy instance forwarded it.
- ~~Volunteer interest "yes"/"maybe" creates exactly one `Task`+`TaskAssignment`, targeted at the correct owner (link owner, or Campaign HQ for the generic link); "supporter only" creates none.~~ **Removed 2026-08-31** along with the volunteer-interest step — see errata above; no longer a contract to test.
- Cross-tenant/RBAC negative: the public route cannot be used to read or infer any other user's or voter's existing data (link-code enumeration doesn't leak which internal users exist beyond "this code is valid/invalid").

## Open items for the implementation plan (not blocking this spec)

- Exact default rate-limit numbers above are a starting point — confirm before first real campaign event, not before writing code.
- Which user account is "Campaign HQ" (existing SuperAdmin, or a new dedicated seed-only account) — a one-line decision for the implementation plan, not an architectural one.
- Placement/design of the internal "get my link" UI — blocked on locked-screen approval, per above.
- The public app's actual custom domain name and whether it's registered/DNS-ready yet — needed before the second Railway service can go live, not before code is written.
- ~~Movement/candidate branding content shape~~ — **resolved** in `docs/features/leadMachine/2026-08-26-landing-page-design-spec.md` §1: static, code-shipped content for this single client (עמך ישראל), not admin-editable. `GET /api/public/support-links/{code}` returns only what the signup form functionally needs — no branding fields.
- `PUBLIC_PROXY_SECRET` generation/rotation process — a one-line operational decision (e.g. generated at first deploy, rotated manually if ever suspected leaked), not architectural.
