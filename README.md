# עמך ישראל — Public Landing + Supporter Signup

Public-facing Hebrew/RTL Next.js app: the movement's landing page and the
supporter self-signup flow. **As currently deployed** (below): `/join` +
`/join/[code]`, no database credentials, every write proxied
server-to-server to the management app (a separate private repo/service).

**Pending change (2026-08-31):** this app is going standalone — its own
database, no dependency on the management app — see
`docs/features/standalone-signup/spec.md`. Designed, not yet implemented;
the description below is still what's actually running.

Design/architecture specs are copied into this repo's own `docs/` (source of
truth lives in the `corporations` repo) — start at `docs/README.md`, which
indexes each feature's `spec.md` + `expected-result.md` under
`docs/features/`.

## Development

```bash
npm install
cp .env.example .env.local   # fill in MANAGEMENT_APP_BASE_URL, PUBLIC_PROXY_SECRET, NEXT_PUBLIC_GENERIC_JOIN_CODE
npm run dev
```

The signup form will not function until the management app's
`/api/public/*` routes (spec'd, not yet implemented) exist — this app is
built against that contract, not against a running backend yet.

## What's intentionally not built yet

- Mobile nav uses a horizontally-scrollable link row, not the spec's
  full gesture-driven sheet (rubber-banding, velocity projection) — a
  reasonable v1 cut, not a silent scope drop.
- §5.5 (optional "why join us" benefit grid) is omitted — conditional on
  the campaign supplying real copy, per spec.
- Favicon set, OG image crop to exact 1200×630 — see spec §8.
- `/privacy` and `/accessibility` are placeholder stubs, not real legal
  content.
