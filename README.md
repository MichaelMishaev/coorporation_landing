# עמך ישראל — Public Landing + Supporter Signup

Public-facing Hebrew/RTL Next.js app: the movement's landing page and the
supporter self-signup flow (`/join`, `/join/[code]`). Holds no database
credentials and no auth — every write proxies server-to-server to the
management app (a separate private repo/service).

Design and architecture specs live in the `corporations` repo:

- `docs/features/leadMachine/2026-08-26-landing-page-design-spec.md` — tokens, section plan, copy sourcing.
- `docs/features/leadMachine/2026-08-26-supporter-self-signup-design.md` — API contract, data model, the same-origin proxy this app implements.

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
- Team-grid name/role legend — the photo is real; the caption data isn't.
- Favicon set, OG image crop to exact 1200×630 — see spec §8.
- `/privacy` and `/accessibility` are placeholder stubs, not real legal
  content.
