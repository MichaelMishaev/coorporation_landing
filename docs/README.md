# Docs Index

This app (the public landing page + supporter self-signup flow for עמך ישראל)
was designed and scoped in the `corporations` repo (the private election
management app this app talks to). These three documents are copied here so
this repo is self-contained and doesn't require access to that repo to
understand what it's building toward.

## Reading order

1. **`Supporter_Acquisition_Module_PRD.md`** — the original product brief. Written
   for a heavier multi-tenant SaaS design than what actually got built; kept for
   context, but most of it was deliberately cut. Read the other two documents
   for what's actually true.
2. **`supporter-self-signup-design.md`** — the backend/architecture spec. Owns
   the API contract this app calls (`/api/public/*` on the management app, via
   this app's own `/api/proxy/*` routes — see "Same-origin proxy"), the data
   model (`SupportLink`, `createVoterForContext`, idempotency, abuse controls),
   and the CRITICAL-lane rules governing that code.
3. **`landing-page-design-spec.md`** — the design spec for what this repo
   actually renders: tokens, section-by-section content, the CTA routing
   decision, asset inventory.

## Current status (2026-08-27)

**Built and deployed** (this repo): the full landing page, `/join` +
`/join/[code]`, and the four `/api/proxy/*` passthrough routes. Live at
`https://coorporation-landing-production.up.railway.app`. See this repo's own
`README.md` for what was intentionally simplified in v1 (mobile nav, the
optional benefit-grid section, favicon/OG crop, `/privacy` and
`/accessibility` placeholder content). Team-member name/role captions shipped
(the lineup section now renders 11 named candidates individually, not the
original single composite photo) — no longer part of this list.

**Not yet built** (the `corporations` repo — this app calls it, but it doesn't
exist yet, so nothing here is end-to-end functional): the `SupportLink`
Prisma model + migration, `createVoterForContext()`, and the `/api/public/*`
routes themselves. That work follows this repo's CRITICAL-lane TDD process
(Codex writes failing tests first) and is tracked in the `corporations` repo,
not here.

**Still open before this is real, not just deployed:**
- `PUBLIC_PROXY_SECRET` is set on this app's Railway service but not yet on
  the management app's production service (that requires a prod redeploy of
  a live app, done deliberately, not as a side effect of this work).
- `NEXT_PUBLIC_GENERIC_JOIN_CODE` is unset — no real `SupportLink` row exists
  yet for the generic `/join` entry point to point at.
- The management app's dashboard needs an outbound link to this app's domain,
  and a "get my personal link + QR" UI — both touch that app's LOCKED
  screens and need explicit approval there before implementation.
