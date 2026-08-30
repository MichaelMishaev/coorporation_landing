# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this app is

Public-facing Hebrew/RTL Next.js app for עמך ישראל: the movement's landing
page (`/`) and the supporter self-signup flow (`/join`, `/join/[code]`). It
holds **no database credentials and no auth** — every write proxies
server-to-server to a separate private repo/service ("the management app").

Design/architecture specs are copied into `docs/` (source of truth lives in
the `corporations` repo): read `docs/README.md` first — it explains reading
order and the current build status (what's live vs. what's still unbuilt on
the management-app side).

## Commands

```bash
npm install
cp .env.example .env.local   # fill in MANAGEMENT_APP_BASE_URL, PUBLIC_PROXY_SECRET, NEXT_PUBLIC_GENERIC_JOIN_CODE
npm run dev                  # next dev (Turbopack)
npm run build                # next build
npm run lint                 # eslint
```

There is no test suite/framework configured in this repo yet.

The signup form will not function end-to-end until the management app's
`/api/public/*` routes exist (they're spec'd, not implemented) — this repo is
built against that contract, not against a running backend.

## Architecture

**Same-origin proxy pattern.** The browser never talks to the management app
directly. All four `/api/proxy/*` routes (`cities`, `support-links/[code]`,
`support-signup`, `support-signup/[id]/interest`) are thin wrappers that call
`forwardToManagementApp()` in `lib/proxy.ts`, which:
- Forwards method/body verbatim to `${MANAGEMENT_APP_BASE_URL}${path}`.
- Adds `X-Public-Proxy-Secret` (shared secret, server-side only) and
  `X-Original-Client-IP` (parsed from `x-forwarded-for`/`x-real-ip`).
- Does zero validation/dedup/RBAC — all of that lives in the management app.
- Returns a generic 502 (no stack trace/config detail) if env vars are
  missing, since that's a deploy problem, not a client error.

When adding a new proxied endpoint, follow this pattern exactly: a one-line
route handler calling `forwardToManagementApp`, no logic in the route itself.

**Signup flow.** `SignupForm` (`app/join/SignupForm.tsx`, client component)
drives a state machine (`loading → inactive|form → submitting → done`):
1. On mount, checks the link code via `/api/proxy/support-links/[code]` and
   loads the city list via `/api/proxy/cities` in parallel. An invalid/inactive
   link short-circuits to the `inactive` state — the city list must come from
   the platform's real DB, never a hardcoded Hebrew list in this repo.
2. Submits to `/api/proxy/support-signup` with a client-generated
   `clientSubmissionId` (idempotency) and a hidden honeypot field (abuse
   control — see spec).
3. On success, optionally posts a secondary "interest" follow-up
   (`/api/proxy/support-signup/[id]/interest`) — this always fails silently;
   the thank-you screen is already committed regardless of whether this
   secondary call succeeds.

Two entry points share `SignupForm`: `/join` reads a generic link code from
`NEXT_PUBLIC_GENERIC_JOIN_CODE` (public by design — it's a link code, not a
secret); `/join/[code]` passes the URL param straight through as a personal
recruiter link.

**Landing page** (`app/page.tsx`) composes ordered sections from
`app/components/sections/*` inside `RevealSection` scroll-reveal wrappers —
only the first three below-the-fold sections (mission band, who-we-are,
lineup) get the entrance animation; hero and footer stay static. Section
order and scope follow `docs/landing-page-design-spec.md` §5; do not reorder
without checking that spec (some sections, like the §5.5 benefit grid, are
deliberately omitted pending real campaign copy).

**Styling**: CSS Modules per component (`*.module.css` alongside each
`.tsx`), plus shared utility classes (`text-heading`, `text-body`,
`text-label`) from `app/globals.css`. `dir="rtl"`/`lang="he"` are set at the
`<html>` level in `app/layout.tsx`; there is no i18n framework — this is a
single-locale (Hebrew) app.

## Known intentional gaps (v1 scope cuts, not bugs)

See the README for the full list — notably: mobile nav is a scrollable link
row (not the spec's gesture sheet), `/privacy` and `/accessibility` are
placeholder stubs, and team-grid captions/exact OG-image crop are unfinished.
Don't "fix" these without checking whether they're an intentional cut first.
