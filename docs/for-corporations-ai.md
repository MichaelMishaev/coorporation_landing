# For whoever/whatever is working on the `corporations` repo

**Purpose of this document:** `coorporationLanding` (the public עמך ישראל
landing page + supporter signup app) went through an architecture change
and is now substantially built and deployed. This file is written to be
handed directly to a Claude session (or any AI/developer) working in the
**`corporations`** repo — it does not assume that reader has access to
`coorporationLanding`'s own files, so everything relevant is inlined here
rather than referenced by path.

---

## What this app is and what changed, in one paragraph

`coorporationLanding` is the public-facing Hebrew/RTL landing page and
supporter signup flow (`/`, `/join`) for the עמך ישראל movement. It used
to depend on `corporations` deploying a set of `/api/public/*` routes
(link resolution, city list, signup creation) that every browser request
would proxy through. **That dependency has been permanently removed and
the replacement is now built, tested, and deployed to a dev environment.**
`coorporationLanding` is standalone: its own Postgres database, its own
signup-storage/idempotency/rate-limiting logic, zero runtime calls to
`corporations` or its API, ever. This was a deliberate decision, not a
temporary workaround — confirmed before making it that `/api/public/*`
doesn't exist on either `corporations`' `dev` (`test.rbac.shop`) or `prod`
(`app.rbac.shop`) backend.

**Current deployment status (as of 2026-08-31):** the standalone backend
is merged into `coorporationLanding`'s `develop` branch and live at
`https://coorporation-landing-dev-development.up.railway.app/join` (dev
only). It has **not yet been promoted to `main`/production** —
`https://amach.rbac.shop/join` (the current live public URL) is still
running the old proxy-to-`corporations` architecture for the moment. When
prod is promoted (a separate, later step), the same `amach.rbac.shop` URL
keeps working — no URL change happens on the `corporations` side.

## What this means for `corporations` — the short version

**Nothing is required.** `coorporationLanding`'s signup flow works
end-to-end without any change on the `corporations` side. There is no API
contract to implement, no `SupportLink` model that needs populating, no
shared secret that needs to match.

**One data fact worth knowing about, one URL answer, and two optional
cleanups** — none of these block anything:

---

## 1. FYI: the public signup form's city list was read (once, read-only) from your production `cities` table

`coorporationLanding`'s `/join` city dropdown now offers the full list of
86 **active** cities (`is_active = true`) from `corporations`' production
`cities` table, pulled via a **one-time, read-only** `SELECT` on
2026-08-31 (3 inactive cities in that table — אריאל, ביתר עילית, מעלה
אדומים — were excluded). This is a **static snapshot baked into
`coorporationLanding`'s own code**, not a live query — `coorporationLanding`
still has zero runtime dependency on `corporations`' database. If your
`cities` table changes (a city added, renamed, activated/deactivated),
**`coorporationLanding`'s dropdown will not pick that up automatically** —
someone needs to manually refresh its static list (a one-file change, no
architecture impact). Flagging this so it isn't a surprise later if the
two lists drift apart; not something that needs action from your side
now.

## 2. Answered: what URL to use if you add an outbound link to the signup page

An earlier version of this document asked you to add a link/button
somewhere in the internal dashboard pointing staff to the public signup
page, with the actual domain "not yet decided." That's now answered:

**Use `https://amach.rbac.shop/join`.** That's the current live public
URL and it will **stay the same** through the upcoming prod promotion of
the standalone backend — the domain doesn't change, only what runs behind
it does. No per-user or per-recruiter personal link exists anymore (see
"What's explicitly not being asked for" below) — this is one static URL
for everyone.

**Unrelated, don't confuse the two:** `coorporationLanding`'s own pages
now also link out to `https://amchaisrael.co.il/` (the movement's
existing, separately-hosted official site — not part of this Railway
project, not related to `corporations` either) as a logo/brand-mark
click-through. That's a different, independent domain and has no bearing
on which URL to use for the dashboard link above.

## 3. Optional cleanup: the partially-built `/api/public/*` work

If `corporations` has any in-progress or already-committed work
implementing `/api/public/*` routes, a `SupportLink` Prisma model/
migration, or `createVoterForContext()` specifically for the old
supporter-signup proxy contract — **none of that is needed anymore.**
Safe to leave as unused/dead code, or safe to remove — entirely your call,
`coorporationLanding` will never call any of it either way.

(If it's useful context: a commit titled `feat(voters): add secure public
supporter signup` existed on `corporations`' `origin/develop`, authored by
`test <test@test.local>` — apparently autonomous/unattended work from
earlier in this transition, not something a person reviewed and pushed
deliberately. Worth being aware of if you go looking at what's already
there.)

## 4. Optional cleanup: shared-secret env vars

If `PUBLIC_PROXY_SECRET` was ever set on any `corporations`-side Railway
service (`rbac_hierarchy` / `rbac_hierarchy_dev`) specifically for this
integration, it's no longer read by anything and can be removed whenever
convenient. Not urgent, not required.

---

## What's explicitly *not* being asked for

To avoid a well-intentioned session building something unrequested:

- **No personal/per-recruiter signup links.** The old design let each
  internal user generate their own attributed link (`/join/{code}`, tied
  to a `corporations` `User`). That's gone. There is exactly **one**
  public signup URL (`https://amach.rbac.shop/join`), static, for
  everyone. If personal attribution is wanted again later, that's a real,
  separate, future decision — not something to build proactively here.
- **No `/api/public/*` implementation.** Explicitly not needed — see
  above.
- **No data sync/export path.** `coorporationLanding` stores signups in
  its own database with **no automatic path back into `corporations`'
  `Voter` table.** If the campaign wants to act on these leads inside
  `corporations`, that's a deliberately deferred, separate future
  decision (CSV export, manual review, a sync job — none chosen yet) —
  not something to build reactively from this document.
- **No `SupportLink` migration, no shared-secret coordination, no CORS
  changes, no live query access to your `cities` table.** None of the old
  integration surface is load-bearing anymore, and the city-list pull
  above was a one-time snapshot, not a standing integration.

---

## If something here seems wrong or out of date

This document was written from the `coorporationLanding` side on
2026-08-31 (updated same day after the standalone backend deployed to
dev). If you're reading it significantly later, or something here
contradicts what you're actually seeing in the `corporations` codebase,
trust what you observe over this document and flag the discrepancy back
to the person who handed you this file — it was correct as of when it
was written, not necessarily now.
