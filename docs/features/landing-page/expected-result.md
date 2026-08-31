# Public Landing Page — Expected Result

Acceptance criteria for the design spec in `spec.md`. Extracted from that
document's decision sections (§2 anti-averaging, §3.5 elevation, §4 CTA
routing, §6 accessibility, §7 navigation rule) and restated as pass/fail
checks.

## Visual discipline

- **Zero `box-shadow`, blur, or glow anywhere on the page** except the
  logo mark's fixed brand gradient (§3.5). Any `box-shadow` in a review
  diff is a defect, not a style choice.
- **`--accent-cta` (`#9b00d6`) appears as a filled surface at most once per
  viewport**, and only on the primary CTA. No two chromatic accent moments
  compete in the same screenful (§2's anti-averaging rule).
- No dark mode shipped in v1 (deferred per §3.1/§9 — `--accent-cta` fails
  contrast on the brand's dark ground without a re-picked variant).

## CTA routing

- **Every CTA on the page — nav, hero, volunteer band, closing band — points
  at `/join`.** None point anywhere else; there is no second form. *(Still
  current.)*
- ~~`/join` renders the signup form directly (no redirect to `/join/{code}`)
  using the generic code read from `NEXT_PUBLIC_GENERIC_JOIN_CODE`.~~
  ~~If that env var is missing or the generic link is inactive, the CTA still
  renders and `/join` shows the standard Hebrew "הקישור אינו פעיל" state —
  never a broken button, never a stack trace.~~ **Superseded** — no code, no
  env var, no inactive state under the standalone architecture; `/join`
  always renders the form directly. See
  `docs/features/standalone-signup/spec.md`.

## Accessibility

- WCAG 2.1 AA holds for every text/background pairing in §3.1 (the spec's
  own measured contrast ratios all clear AA, most clear AAA).
- Every interactive element has a visible 2px focus ring — never removed,
  since the page has no shadows to substitute as a focus signal.
- Full keyboard path exists: nav → each CTA → footer, in DOM order (which
  is logical order even under RTL).
- Real landmarks (`header`/`nav`/`main`/`footer`), exactly one `h1`, no
  heading-level skips.
- Team photos carry descriptive Hebrew `alt` text (name and role) — never
  empty `alt`.
- `prefers-reduced-motion: reduce` and `prefers-contrast: more` are both
  honored per §3.6/§3.7 — entrances fall back to opacity-only, hairlines
  thicken and darken.

## Navigation boundary (§7)

- No link, button, or menu item anywhere on the public page points at the
  management app's domain.
- No admin/coordinator/login affordance anywhere, including hidden or
  footer-only ones.
- No asset (logo, font) hotlinked from the management domain.
- No shared analytics property, tag manager container, or error-reporting
  DSN naming or resolving to the management host.
- No mention of the management app in copy, error states, `robots.txt`,
  sitemap, or HTML comments.
- ~~All public-facing calls to the management app's API stay server-to-server
  through this app's own `/api/proxy/*` routes — the browser never calls
  the management domain directly (see
  `docs/features/supporter-self-signup/spec.md` §"Same-origin proxy").~~
  **Superseded** — under the standalone architecture there is no
  management-app API to call at all, proxied or otherwise; this bullet
  described a mechanism for a dependency that no longer exists. See
  `docs/features/standalone-signup/spec.md`. The surrounding no-mention/
  no-hotlink/no-admin-affordance bullets above still hold.

## Explicitly out of scope for v1 (see `spec.md` §9 — do not treat as gaps)

Dark mode, the §5.5 benefit grid (conditional on product-owner copy that
never arrived), balcony-sign merch, analytics tooling choice, any
non-Hebrew locale, and final privacy/accessibility page *content* (the
footer links exist; the page content is a separate legal/content
deliverable).
