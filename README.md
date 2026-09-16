# עמך ישראל — Public Landing + Supporter Signup

Public-facing Hebrew/RTL Next.js app: the movement's landing page and the
supporter self-signup flow. **As currently deployed** (below): `/join` +
`/join/[code]`, no database credentials, every write proxied
server-to-server to the management app (a separate private repo/service).

**Pending change (2026-08-31):** this app is going standalone — its own
database, no dependency on the management app — see
`docs/features/standalone-signup/spec.md`. **Implemented and committed**
on branch `standalone-signup-backend` (code complete, reviewed by two
independent reviewers) — **not yet merged into `develop` and not yet
deployed**. The description below (proxy architecture, three env vars)
is still what's actually running in both dev and prod; the Development
section further down already reflects the new `DATABASE_URL`-based setup
for anyone working on the `standalone-signup-backend` branch.

Design/architecture specs are copied into this repo's own `docs/` (source of
truth lives in the `corporations` repo) — start at `docs/README.md`, which
indexes each feature's `spec.md` + `expected-result.md` under
`docs/features/`.

## Development

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL (a Postgres connection string —
                              # for local dev, the Railway dev Postgres's public TCP
                              # proxy connection string, or any local Postgres)
npx prisma migrate dev
npm run dev
```

This reflects the standalone backend on branch `standalone-signup-backend`
(own Postgres, own `/api/signup` route) — see
`docs/features/standalone-signup/spec.md`. It is implemented and committed
but not yet merged into `develop` or deployed; the management-app proxy
setup described above is what's still live in dev/prod until this branch
merges.

## What's intentionally not built yet

- Mobile nav uses a horizontally-scrollable link row, not the spec's
  full gesture-driven sheet (rubber-banding, velocity projection) — a
  reasonable v1 cut, not a silent scope drop.
- §5.5 (optional "why join us" benefit grid) is omitted — conditional on
  the campaign supplying real copy, per spec.
- Favicon set, OG image crop to exact 1200×630 — see spec §8.
- `/privacy` and `/accessibility` are placeholder stubs, not real legal
  content.
