# For whoever/whatever is working on the `corporations` repo

**Purpose of this document:** `coorporationLanding` (the public עמך ישראל
landing page + supporter signup app) just went through an architecture
change. This file is written to be handed directly to a Claude session (or
any AI/developer) working in the **`corporations`** repo — it does not
assume that reader has access to `coorporationLanding`'s own files, so
everything relevant is inlined here rather than referenced by path.

---

## What changed, in one paragraph

`coorporationLanding` used to depend on `corporations` deploying a set of
`/api/public/*` routes (link resolution, city list, signup creation) that
this app would proxy every browser request through. That dependency has
been **permanently removed**. `coorporationLanding` is now standalone: its
own Postgres database, its own signup-storage and validation logic, zero
runtime calls to `corporations` or its API, ever. This was a deliberate
decision, not a temporary workaround — confirmed before making it that
`/api/public/*` doesn't exist on either `corporations`' `dev`
(`test.rbac.shop`) or `prod` (`app.rbac.shop`) backend as of 2026-08-31.

## What this means for `corporations` — the short version

**Nothing is required.** `coorporationLanding`'s signup flow will work
end-to-end without any change on the `corporations` side at all, once its
own implementation plan (tracked separately, in `coorporationLanding`'s
own repo) is built and deployed. There is no API contract left to
implement, no `SupportLink` model that `coorporationLanding` needs
populated, no shared secret that needs to match.

**One optional, genuinely useful item, and two optional cleanups** — none
of these block anything, listed in order of actual value:

---

## 1. Recommended: add an outbound link to the public signup page in the management dashboard

**What:** somewhere sensible in the internal dashboard UI (wherever makes
sense to your own screen-lock/LOCKED-screens process — this is a request,
not a UI spec), add a link or button that takes staff to the public signup
page, so they can find it and share it (post it, put it on a flyer, etc.).

**What it should link to:** a **static URL, decided once, hardcoded** —
there is no per-user or per-recruiter personal link anymore (that concept
was dropped along with the API dependency; see "What's explicitly *not*
being asked for" below). As of 2026-08-31 the exact domain is **not yet
decided** — options are the Railway-provided subdomain
(`https://coorporation-landing-production.up.railway.app/join`) as an
interim value, or a real custom domain once one is registered/configured.
**Confirm the actual current value with the person who asked you to make
this change before hardcoding it** — don't guess or reuse a domain from
memory, since this is exactly the kind of detail that goes stale.

**Why this is worth doing:** it's the one piece of this whole transition
that only `corporations` can do (an outbound pointer from the internal
tool to the public one) — everything else is entirely inside
`coorporationLanding` now.

## 2. Optional cleanup: the partially-built `/api/public/*` work

If `corporations` has any in-progress or already-committed work
implementing `/api/public/*` routes, a `SupportLink` Prisma model/
migration, or `createVoterForContext()` specifically for the old
supporter-signup proxy contract — **none of that is needed anymore.**
It's safe to leave as unused/dead code if reverting it isn't worth the
effort, or safe to remove if it's not needed for anything else. This is
entirely your call and entirely optional — `coorporationLanding` will
never call any of it either way.

(If it's useful context: as of this writing, a commit titled `feat(voters):
add secure public supporter signup` already exists on `corporations`'
`origin/develop`, authored by `test <test@test.local>` — apparently
autonomous/unattended work from earlier in this transition, not something
a person reviewed and pushed deliberately. Worth being aware of if you go
looking at what's already there.)

## 3. Optional cleanup: shared-secret env vars

If `PUBLIC_PROXY_SECRET` was ever set on any `corporations`-side Railway
service (`rbac_hierarchy` / `rbac_hierarchy_dev`) specifically for this
integration, it's no longer read by anything and can be removed whenever
convenient. Not urgent, not required.

---

## What's explicitly *not* being asked for

To avoid a well-intentioned session building something unrequested:

- **No personal/per-recruiter signup links.** The old design let each
  internal user generate their own attributed link (`/join/{code}`,
  tied to a `corporations` `User`). That's gone. There is exactly **one**
  public signup URL, static, for everyone. If personal attribution is
  wanted again later, that's a real, separate, future decision — not
  something to build proactively here.
- **No `/api/public/*` implementation.** Explicitly not needed — see
  above.
- **No data sync/export path.** `coorporationLanding` now stores signups
  in its own database with **no automatic path back into `corporations`'
  `Voter` table.** If the campaign wants to act on these leads inside
  `corporations`, that's a deliberately deferred, separate future
  decision (CSV export, manual review, a sync job — none chosen yet) —
  not something to build reactively from this document.
- **No `SupportLink` migration, no shared-secret coordination, no CORS
  changes.** None of the old integration surface is load-bearing anymore.

---

## If something here seems wrong or out of date

This document was written from the `coorporationLanding` side, once,
on 2026-08-31. If you're reading it significantly later, or something
here contradicts what you're actually seeing in the `corporations`
codebase, trust what you observe over this document and flag the
discrepancy back to the person who handed you this file — it was
correct as of when it was written, not necessarily now.
