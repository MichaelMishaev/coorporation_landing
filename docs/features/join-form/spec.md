# `/join` Signup Form — Field & Scenario Spec

**Date:** 2026-08-31
**Status:** Draft, pending review

**Partially superseded (2026-08-31):** this document's **field-level**
decisions (name/phone mandatory, city optional, the trim-and-validate
rule, `maxLength` parity, the `clientSubmissionId` generation/rotation
rules) still hold and are implemented on `develop`, **except city**: as
of 2026-09-01 city is mandatory (label, client validation, and
server-side rejection of a missing/blank `cityName`). Everything about
**entry points and link validity** — the `/join` vs `/join/[code]`
distinction, the mount gate, the `loading`/`inactive` states, the
link-check `useEffect`, and every scenario/criterion below keyed to those
— is superseded by the move to a standalone architecture with a single,
always-live `/join` form and no link concept at all. See
`docs/features/standalone-signup/spec.md` "Relationship to existing
`/join` work" for the precise line. Kept in full below as historical
record of decisions that were correct for the architecture that existed
when this was written.

**Relationship to other docs:** `docs/features/supporter-self-signup/spec.md` is the
approved backend/architecture spec for this whole feature (data model, API
contract, abuse controls). This document does not replace it — it narrows in
on the one part that was ambiguous in practice: the signup form's exact
field-level requirements and the scenarios around them. Written after a
cross-session coordination failure on the backend side (see "Why this
document exists") — the goal is a single, unambiguous source of truth for
what this repo's form must do, so implementation (here or on the
`corporations` side) has nothing left to guess at.

## Why this document exists

While `docs/features/supporter-self-signup/spec.md` was being implemented on the
`corporations` side, multiple uncoordinated sessions/agents edited the same
files concurrently with no shared spec to check against, which produced a
real regression (a documented security check ordering — kill-switch before
secret-check — got silently reversed, twice, by different actors who didn't
know the rule existed). This document exists so the *form-level* behavior
(this repo's actual responsibility) is nailed down in writing before more
implementation happens, rather than re-derived ad hoc.

**Scope boundary:** this document only specs the `coorporationLanding` side
(the form and its client-side behavior). Anything requiring a change in
`corporations` is called out explicitly as an **open cross-repo item** and is
not this repo's work to build — see "Cross-repo dependencies" at the end.

## Field requirements

| Field | Required? | Notes |
|---|---|---|
| Full name (`fullName`) | **Mandatory** | Enforced client-side (`required`) and server-side (`z.string().min(1).max(200)`). Native `required` alone passes whitespace-only input — trimmed and re-checked client-side before submit, see Scenario 4. |
| Phone (`phone`) | **Mandatory** | Already enforced client-side (`required`, `type="tel"`) and server-side (`z.string().min(1).max(30)`). **No client-side shape validation today** — see Scenario 1 below. |
| City (`cityId`) | **Optional** | Currently `required` in the client, and the blank option is `disabled` — both need to change. Server-side already accepts the key as `.optional()`, but a present empty string still fails `.min(1)` — see "City handling" for the exact wire-contract fix required (omit the key, don't send `""`). |

## City handling

Confirmed against `corporations`' actual schema and `getUserContext()` logic
(read once, before the repo-access boundary below was reaffirmed — not
re-verified since, treat as a snapshot):

- A `SupportLink` owner with role `CITY_COORDINATOR`, `ACTIVIST_COORDINATOR`,
  or `ACTIVIST` resolves to **exactly one `cityId`** (the context helper
  fails closed if it can't find one).
- A `SupportLink` owner with role `AREA_MANAGER` resolves to an
  `areaManagerId` — a **region spanning many cities**, not one.
- `SUPERADMIN` and the generic link's "Campaign HQ" owner have **no city
  scope at all**.

**Intended behavior:** when the supporter leaves city blank, the backend
should inherit `voterCity` from the link owner's own city if the owner has
exactly one (the three scoped roles above); when the owner has no single
city (`AREA_MANAGER`, `SUPERADMIN`, generic link), the field stays genuinely
optional and unfilled if the supporter skips it.

**Current reality, as of the last check:** the backend does *not* do this
inheritance yet — `cityId` omitted just leaves `voterCity` unset, for every
owner role. This is a **cross-repo dependency**, not something built yet
(see bottom of doc).

**What this repo must do — corrected.** Removing `required` from the
`<select>` alone is **not sufficient and would introduce a bug**: `cityId`
state defaults to `""` and the submit handler always includes `cityId` as a
key in the JSON body (`SignupForm.tsx:59`). The backend schema is
`z.string().min(1).max(200).optional()` — `.optional()` permits the key to
be *absent*, but `.min(1)` still rejects it if present as `""`. Submitting a
blank city as `cityId: ""` would therefore fail the whole request as
`invalid_input`, not just skip the city. **Required client fix: when no
city is selected, omit the `cityId` key from the request body entirely**
(e.g. build the body via a spread that only adds `cityId` when truthy),
not send it as an empty string.

**Also required: the blank option must become selectable, and relabeled.**
Today `<option value="" disabled>בחר/י עיר</option>` ("choose a city") can
never be re-selected once a city is chosen (`SignupForm.tsx:151`) — if city
is genuinely optional, the supporter must be able to leave it blank, which
requires removing `disabled`. But leaving the label as an imperative
placeholder ("choose a city") on a now-selectable option is misleading —
it would read as an instruction, not a real "no city" choice. Relabel that
option to something that reads as a deliberate choice, e.g. "ללא ציון עיר"
("no city specified").

**Also required: signal optionality in the field label itself.** Nothing
today distinguishes this field from the two mandatory ones — a supporter
has no reason to assume it's skippable. Add an explicit marker to the label
(e.g. "עיר (לא חובה)" — "city (optional)"), matching how the mandatory
fields already read as plain "שם מלא" / "טלפון נייד" with no such marker.

## Entry points

- `/join` — generic link. Code comes from `NEXT_PUBLIC_GENERIC_JOIN_CODE`
  (public by design, not a secret). **Corrected: this path does not always
  render `SignupForm`.** `app/join/page.tsx` gates server-side: if the env
  var is empty, it renders its own bare `<p>הקישור אינו פעיל</p>` and never
  mounts `SignupForm` at all (no city/link fetch happens). Only when the
  env var is set does it mount `SignupForm`.
- `/join/[code]` — personal link, generated on the `corporations` side by an
  eligible internal user (`ACTIVIST`, `ACTIVIST_COORDINATOR`,
  `CITY_COORDINATOR`, `AREA_MANAGER`). The code comes straight from the URL
  param, and `SignupForm` **always mounts** — an invalid code is only
  discovered client-side, inside `SignupForm`'s own load effect.

Once `SignupForm` does mount, both paths hit the same `/api/proxy/*` routes
and share the same client-side state machine below — the divergence is only
in whether/how the component gets mounted in the first place.

## Link validation states

Two distinct gates exist and must not be conflated:

**Gate 1 — mount gate, `/join` only, server-side, no styling from
`SignupForm.module.css`:** missing `NEXT_PUBLIC_GENERIC_JOIN_CODE` renders a
plain unstyled paragraph before `SignupForm` ever mounts. `/join/[code]`
has no equivalent — it always mounts.

**Gate 2 — in-component state machine, both paths, inside `SignupForm`:**

| State | Trigger | Current UX |
|---|---|---|
| `loading` | Initial mount | "טוען..." |
| `form` | Link check succeeds | Full form shown |
| `submitting` | Submit handler in flight (`handleSubmit`) | Same form, submit button `disabled`, no spinner or progress text |
| `inactive` | Link check fails (`!linkRes.ok`) **or** any thrown error (network failure, JS exception) | "הקישור אינו פעיל" ("this link isn't active") — identical copy for a truly dead link and a transient network blip |
| `done` | Successful submission | Thank-you screen |

A rejected/errored **submit** (as opposed to the initial link check) does
not go to `inactive` — it stays on `form` with an inline error message
under the fields (see "Submit-time errors" below).

## Known local blocker (not a bug in this repo)

`localhost:3387/join` currently always shows `inactive`, because
`.env.local` has `NEXT_PUBLIC_GENERIC_JOIN_CODE=` (empty). This matches a
still-`pending` item on the `corporations` side's own task list: wiring a
real generic `SupportLink` and handing this repo its code. Nothing to fix on
this side until that code exists.

## Scenarios — decided

1. **Phone format.** No client-side pattern validation today (only
   `type="tel"`/`inputMode="numeric"`). **Correction:** whether the backend
   actually rejects a malformed phone is *not verifiable from this repo* —
   `corporations` isn't inspectable from here (see repo-boundary note
   below). Treat "backend validates phone shape" as an **assumption to
   confirm with whoever owns that side**, not a fact this spec asserts.
   **Decision:** no client-side phone regex added in this repo for now —
   stay purely server-enforced, matching this form's existing pattern of
   not duplicating validation client-side (e.g. city/name also aren't
   pattern-checked). Revisit only if real bad-phone submissions show up.
2. **Retry-after-failure duplicate-voter risk — confirmed real; first-draft
   fix had its own gap, now corrected.** `clientSubmissionId` is generated
   fresh *inside* `handleSubmit` on every call (`SignupForm.tsx:64`), so a
   retry after a timeout (the server wrote the row, but the client never
   saw the response) sends a **new** idempotency key, creating a second
   `Voter` row. There's also no client-side request timeout at all (plain
   `fetch`, no `AbortController`) — `submitting` can sit indefinitely on a
   hung connection.
   A blanket "one ID per mount" fix is **not correct**: the backend's
   idempotency check compares a payload digest against the stored receipt
   and returns `conflict` on a mismatch (per
   `docs/features/supporter-self-signup/spec.md`'s idempotency section). If a
   submission fails with a *definitive* response (e.g. a validation error)
   and the user corrects a field and resubmits, reusing the same ID would
   send a *different* payload under that ID — a permanent 409 loop, worse
   than the bug being fixed. Reuse is only safe when the previous attempt's
   outcome is genuinely unknown.
   **Decision — distinguish the two failure modes:**
   - **Ambiguous failure** (the `fetch` call itself throws — network error,
     connection drop, no response at all): the write may have already
     happened server-side. Keep the **same** `clientSubmissionId` for the
     next attempt, *as long as the payload is unchanged* — this is the
     case the backend's idempotency replay is designed for.
   - **Definitive failure** (any HTTP response comes back, ok or not — the
     server told us the outcome, and a non-ok response means nothing was
     written): generate a **fresh** `clientSubmissionId` for the next
     attempt. This is what makes "fix the phone number and resubmit" work
     without a conflict.
   - **Any field edit after a failed attempt** invalidates the previous ID
     regardless of failure mode — treat it as a new attempt. This narrows
     the ambiguous-failure race to its actual scope: an unmodified retry
     after a hang, which is the scenario this fix targets.
   Still **no** client-side timeout/abort — an artificial timeout while the
   write may still be in flight would reintroduce the exact ambiguity this
   fix is designed to resolve.
3. **Invalid link vs. transient failure look identical — accepted,
   documented as intentional.** A truly deactivated/unknown link and a
   one-off network blip both land on `inactive` with the same copy. This
   matches the architecture spec's stated policy of never differentiating
   failure reasons to an unauthenticated caller. **Decision:** keep as-is;
   this is deliberate, not a gap.
4. **Whitespace-only name passes client-side validation.** A name of
   `"   "` satisfies HTML's `required` check, and is sent unchanged
   (`SignupForm.tsx:59` does not `.trim()`). Whether the backend Zod schema
   rejects it is unverifiable from this repo (whitespace satisfies
   `min(1)` on raw string length too, so likely not rejected there either).
   **Decision — trimming at submit time alone is not enough.** Native
   `required` only blocks a truly-empty value, so `"   "` still passes the
   browser's own gate and would reach the network layer, coming back as a
   generic, confusing round-trip error rather than a clear local one.
   Required fix: on submit, compute `fullName.trim()`; if the result is
   empty, set a specific inline error (e.g. "אנא הזן שם מלא") and `return`
   before calling `fetch` — do not let a whitespace-only name reach the
   network. If the trimmed result is non-empty, send the trimmed value.
5. **Stale doc cross-reference — confirmed.** `docs/features/supporter-self-signup/spec.md`
   still describes a volunteer-interest yes/maybe/no follow-up step in its
   scope, architecture, proxy-route list, and a dedicated section. That
   feature was fully removed (this repo's `.../interest/route.ts` proxy is
   deleted; `corporations` task list shows it removed too; current
   `SignupForm` goes straight from submit to `done`). **Decision:** that
   doc needs an errata/update noting the removal — flagged here, fixed as a
   separate small doc change, not part of this spec.
6. **City-list fetch failure or empty list.** A non-OK `/api/proxy/cities`
   response is swallowed into `{ cities: [] }` (`SignupForm.tsx:36`) and the
   form still renders with a city select that has no real options. Now that
   city is optional (see "City handling" fix above, including the
   selectable blank option), this is **no longer a blocking bug** — a
   supporter simply sees an empty-but-skippable city field and can still
   submit. **Decision:** no additional handling needed; document this as
   the accepted behavior, not an open question.
7. **Submit-time errors are all identical, regardless of cause.** Invalid
   input, rate-limiting, an inactive link discovered at submit time, and an
   upstream 5xx all produce the same "אירעה שגיאה. נסו שוב בעוד רגע." inline
   message, form retained (`SignupForm.tsx:69`). This matches the
   architecture spec's "no field-name/status leaks" policy for the create
   route. **Decision:** keep as-is; intentional, not a gap.
8. **Success is HTTP-status-only, body shape unchecked.** Any `response.ok`
   is treated as success without parsing/validating the response body
   (`SignupForm.tsx:69`). **Decision:** acceptable — the proxy is a
   transparent passthrough (`lib/proxy.ts`) with no body-shape contract of
   its own to violate; relying on HTTP status alone is consistent with how
   this repo already treats every other proxy call. No change needed.
9. **Client-side length limits don't match the documented server bounds.**
   Name/phone inputs have no `maxLength`, so the 200/30-char server bounds
   aren't mirrored client-side — an over-limit value is only rejected after
   a round trip. **Decision:** add `maxLength={200}` to the name input and
   `maxLength={30}` to the phone input, matching the server schema exactly
   — cheap parity fix, no cross-repo dependency.

## Cross-repo dependencies (not this repo's work to build)

- City-inheritance-from-owner logic in `corporations`' public-signup path
  (see "City handling" above).
- `NEXT_PUBLIC_GENERIC_JOIN_CODE` needs a real generic `SupportLink` seeded
  on the `corporations` side, then the value handed to this repo's env
  config (local `.env.local` and the Railway service).
- Any further backend regression from the concurrent-editing incident
  referenced in "Why this document exists" — out of scope for this repo and
  this document.
