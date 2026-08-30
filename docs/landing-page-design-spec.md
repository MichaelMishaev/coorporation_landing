# Public Landing Page — Design Spec ("עמך ישראל")

**Date:** 2026-08-26
**Status:** Design spec, pending review → implementation plan
**Lane:** STANDARD — a static, read-only Hebrew/RTL marketing surface in the greenfield `public-landing/` app. It performs no data writes of its own and holds no credentials. It **depends on** the CRITICAL-lane backend already specified in `docs/features/leadMachine/2026-08-26-supporter-self-signup-design.md`; that document's lane governs the signup path, this one governs only the marketing surface in front of it.

**Scope boundary:** this document specifies the public app's root page (`/`), its shared layout/nav/footer, its design tokens, and how it hands off to `/join`. It does **not** re-specify the signup form, its data model, or its abuse controls — those are locked in the sibling spec and are not relitigated here.

**Screen-lock note:** `public-landing/` is greenfield. It is **not** one of the management app's LOCKED dashboard screens, and no per-screen approval gate applies to designing or building its pages. The one exception is §7, which touches the management app's own nav and therefore does require approval.

---

## 1. Origin

The movement is **עמך ישראל** (Am Chai Israel), led by **עופר וינטר**, with a real, live public site at `https://amchaisrael.co.il/`. This platform is single-tenant, built for this one client. That resolves an open item the sibling spec left dangling (its final open bullet: static config vs. admin-editable branding):

> **Resolved: branding is static, code-shipped content.** Colors, logo, copy, and section structure ship with the `public-landing/` deploy. There is no branding config table, no CMS, and `GET /api/public/support-links/{code}` returns no branding fields — it returns only what the form needs to function. A copy change is a deploy of a service that holds zero credentials and cannot touch RBAC-critical code, which was the whole point of splitting the app in two.

## 2. Reference lock and decision ledger

One dominant direction, not an average. The **Lottielab style's restraint is the structural backbone**; the movement's own brand fills the single-accent role that style reserves for its own violet.

| Decision | Source | Role | Why |
|---|---|---|---|
| Colors, logo, typeface, headline copy | `amchaisrael.co.il` (the client's own live site) | **Literal, non-negotiable** | This is the client's actual brand identity, not third-party inspiration. Reusing it is the requirement, not a shortcut. |
| Layout, spacing, elevation, component discipline | Refero style `1f782141-d407-4c27-8cee-2246720a9f42` (Lottielab) | **Reinterpreted** — re-roled colors, re-fonted, RTL-mirrored | Its thesis ("near-white canvas, hairline borders, single accent, flat surfaces, surgical color") gives a political page credibility. Loud gradients and shadows read as cheap; restraint reads as serious. |
| Motion and interaction feel | `apple-design` skill | **Principles, adapted** | Critically-damped springs, pointer-down feedback, interruptibility, reduced-motion parity. |
| Hero + alternating editorial rhythm + multi-CTA cadence | Refero screen `f809b71a-7658-4d9a-891a-e5ceae8b234f` (GoFundMe) | **Structural** | Proven cause/movement storytelling rhythm. |
| Team grid layout | Refero screens `0ff7568e-…` (ClassPass) + `c0049476-…` (LottieFiles) | **Structural** | Maps onto the movement's own real "הנבחרת" section rather than inventing a layout. |
| Benefit/icon grid + CTA | Refero screen `82964fe9-…` (Miro nonprofit) | **Structural, optional** | Only if §5.5's copy clears product-owner review. |
| Typeface | Noto Sans Hebrew (the live site's production choice) | **Literal** | Replaces the reference style's Plus Jakarta Sans, which has no production Hebrew coverage. |

**Anti-averaging rule.** The brand ships four purples. Only **one** of them is a UI accent. `#9b00d6` is the accent and it appears as a filled surface **once per viewport, on the primary CTA only**. The other purples are text and large-surface colors. Never two chromatic moments competing in one screenful.

## 3. Tokens

### 3.1 Color

All values are the live site's own CSS custom properties. v1 ships **light only** — see the decision at the end of this section.

| Token | Value | Role |
|---|---|---|
| `--canvas` | `#ffffff` | Base page ground; the default band. |
| `--canvas-alt` | `#fafafa` | Alternating band (section rhythm step 1). |
| `--canvas-warm` | `#ebe7e1` | Warm cream band — reserved for the mission/quote band and the closing CTA band only, so it stays an event, not wallpaper. |
| `--surface` | `#ffffff` | Cards on a non-white band. |
| `--surface-well` | `#f5f5f5` | Nested/inset surfaces. |
| `--border` | `#e5e5e5` | The 1px hairline. The **only** separation device. |
| `--accent-cta` | `#9b00d6` | Primary CTA fill. Nothing else. |
| `--accent-cta-press` | `#8500b8` | Pressed state (hand-darkened ~8%; not a live-site token). |
| `--text-primary` | `#3e1260` | Body and heading text — the brand's deep purple standing in for near-black. |
| `--text-secondary` | `#4f4e4e` | Sub-copy, captions, footer. |
| `--text-on-accent` | `#fafafa` | Text on the CTA fill. |
| `--brand-purple` | `#4d2472` | Large brand surfaces (footer ground, hero eyebrow). Not a button color. |
| `--brand-purple-light` | `#6f4797` | Hover/underline accents on purple surfaces; decorative rules. |
| `--on-purple` | `#fafafa` | Text on `--brand-purple` surfaces. |

Measured contrast (sRGB, WCAG 2.1) — these are computed, not assumed:

- `--text-primary` on `--canvas` → **14.4:1** (AAA).
- `--text-primary` on `--canvas-warm` → **11.7:1** (AAA).
- `--text-secondary` on `--canvas` → **8.2:1** (AAA).
- `--text-on-accent` on `--accent-cta` → **6.2:1** (AAA large, AA normal). The CTA label is safe at any size.
- `--accent-cta` as text on `--canvas` → 6.2:1 (AA). Permitted but unused, per the one-accent rule.

**Decision: no dark mode in v1.** The live site has one, and the brand already ships dark neutrals (`#0a0a0a`/`#171717`/`#262626`), so tokens are not the blocker. The blocker is measured: `--accent-cta` on `#0a0a0a` is **3.17:1** — AA-large only, failing normal-size text and sitting right on the non-text boundary. A dark theme needs a lightened CTA variant plus a re-validation pass on every hairline border (`#e5e5e5` inverts to a value that has to be re-picked, not flipped). That is a real second design pass, not a media query. Deferred to §9.

### 3.2 Type — Noto Sans Hebrew, RTL-adapted

```
"Noto Sans Hebrew", "Noto Sans", ui-sans-serif, system-ui, sans-serif
```

Loaded from Google Fonts, `he` subset, `font-display: swap`, weights 400/600/700 only. `<html lang="he" dir="rtl">`.

The reference style's Latin scale is adapted, not transcribed. Two Hebrew-specific corrections to `apple-design` §15:

1. **Tracking is `0` at every size — never negative.** The skill's guidance to tighten large display text (`-0.02em`) is correct for Latin and wrong for Hebrew: Hebrew letterforms are already tightly fitted and carry no case or ascender/descender variance, so negative tracking produces collisions and pushes ambiguous pairs (ר/ד, ב/כ, ה/ח) toward misreading. Optional `+0.01em` at caption size only.
2. **Body leading runs looser than the Latin reference.** Hebrew's uniform glyph height makes long measures read as a dense block; body is `1.65`, not the reference's `1.5`.

| Role | Size | Weight | Line-height | Notes |
|---|---|---|---|---|
| Display | `clamp(2.25rem, 5vw, 3.5rem)` (36→56px) | 700 | 1.12 | ~8% below the reference's 60px — Hebrew reads optically larger at equal px. |
| Heading | `clamp(1.75rem, 4vw, 2.75rem)` (28→44px) | 700 | 1.2 | Section titles. |
| Heading-sm | `1.5rem` (24px) | 700 | 1.3 | Card/team-member names. |
| Subheading | `1.125rem` (18px) | 400 | 1.55 | Hero sub-line, section lead-ins. |
| Body | `1rem` (16px) | 400 | 1.65 | Max measure ~65ch. |
| Label | `0.875rem` (14px) | 600 | 1.4 | Nav items, button labels. |
| Caption | `0.75rem` (12px) | 400 | 1.5 | Footer, legal. |

Sizing is in `rem` throughout so the user's browser text-size setting scales the layout with the type (`apple-design` §15).

### 3.3 Spacing — strict 8px grid

`8, 16, 24, 32, 40, 48, 64, 96, 128, 192, 224`. No value off this scale, ever.

- Vertical gap between sections: **80px** mobile → **128px** ≥1024px.
- Max content width **1200px**; horizontal padding **40px** desktop, **24px** <768px.
- Grid gutters: 24px.

### 3.4 Radius

`4px` micro/tags · `8px` cards and inputs · `12px` buttons · `9999px` pills.

### 3.5 Elevation — none

**No box-shadow, no blur, no glow, anywhere on this page.** Depth is communicated only by (a) stepping the surface color (`--canvas` → `--canvas-alt` → `--surface-well`) and (b) 1px `--border` hairlines. This is the single rule most likely to erode during implementation; treat any `box-shadow` in a review diff as a defect.

One exception, and it is an asset, not UI chrome: the **logo mark's blue→purple gradient** (`#3685E3` → `#8F36BF`) is a fixed brand mark. Gradients are forbidden on buttons, inputs, cards, and bands.

### 3.6 Resolved: nav materials — Apple translucency vs. no-blur

The two references genuinely conflict. `apple-design` §12 wants a translucent `backdrop-filter` bar with content scrolling beneath; the Lottielab style forbids blur outright.

**Decision: the no-blur rule wins. The nav is opaque `--canvas` with a 1px `--border` bottom hairline.**

Reasoning, in order of weight:

1. Apple's translucency exists to convey depth *and* to let rich, varied content show through as a signal of what's above and below. Over a near-white flat canvas it produces **no perceptible material effect** — you pay a real compositing cost on mobile for a bar that looks identical to an opaque one.
2. Where it *would* be perceptible is exactly where it hurts: the full-bleed team photo grid (§5.4). A translucent bar over faces produces a shifting, unpredictable backdrop for the nav labels, and the fix Apple prescribes for that (vibrancy, heavier weight, letter-spacing bumps) is unavailable to us because §3.2 forbids Hebrew tracking changes. Opaque is simply more legible here.
3. The brief's anti-averaging instruction: restraint is the backbone. Blur is the first thing to cut.

**What we adopt from Apple instead** is the *scroll edge effect* (§12) in its non-blur form: at `scrollY === 0` the nav has **no** bottom border and sits flush against the hero; the hairline **fades in** (opacity 0→1, 150ms, ease-out) once the page scrolls. Chrome separates itself only when it actually overlaps content. Same intent, zero blur.

The mobile menu is likewise an **opaque** full-height sheet, not a scrim-over-blur.

Because nothing on the page is translucent, `prefers-reduced-transparency` needs no special handling. `prefers-contrast: more` raises hairlines to 2px and darkens `--border` to `#a3a3a3`.

### 3.7 Motion

Default is `damping 1.0` (critically damped, no overshoot), `response 0.3–0.4`. Bounce is reserved for the one gesture-driven element on the page.

| Element | Behavior |
|---|---|
| Primary/secondary CTA | Feedback on **pointer-down**, not click: `scale(0.97)` + fill → `--accent-cta-press`, 100ms ease-out. Release springs back at `damping 1.0 / response 0.3`. Cancel-by-dragging-away supported; ~10px hit padding. |
| Nav hairline | Opacity cross-fade on scroll threshold, 150ms. No transform. |
| Mobile menu sheet | The page's only momentum interaction: 1:1 drag tracking with `setPointerCapture`, rubber-banding past the closed bound, velocity projection on release (`d ≈ 0.998`), spring `damping 0.8 / response 0.3`. Interruptible and reversible mid-flight — a user who grabs a closing sheet must have it follow their finger. Enters and exits along the same edge (`apple-design` §7). |
| Section entrance | Opacity 0→1 plus 8px translate along the block axis, spring `damping 1.0 / response 0.4`, fired once via `IntersectionObserver` at 15% visibility. **Applied to at most the first three sections below the fold** — animating every band is decoration, not craft. |
| Hero | Static. No autoplay, no parallax, no looping background motion. |

`prefers-reduced-motion: reduce` — every entrance becomes a 200ms opacity cross-fade with `transform: none`; the sheet opens/closes as an instant state change with a fade; press feedback keeps its color change and drops the scale. Reduced motion is a gentler equivalent, not the removal of feedback.

Only `transform` and `opacity` are animated.

### 3.8 RTL specifics

- Logical properties throughout: `margin-inline-start/end`, `padding-inline-*`, `inset-inline-*`. No `left`/`right`.
- Directional icons mirror: a "continue" chevron points **left** (`‹`) in RTL, because forward is leftward.
- Things that must **not** mirror: the logo SVGs (fixed brand assets, gradient direction included) and social platform glyphs.
- Phone numbers, and any digit or Latin run inside Hebrew prose, are wrapped in `<bdi>` to prevent bidi reordering. This matters most in the footer contact line.

## 4. Primary CTA routing — the decision

The landing page's primary CTA points at the **generic** `SupportLink` owned by the fixed "Campaign HQ" account (sibling spec, decision 5) — not at any individual recruiter, since a page seen by the whole public has no personal recruiter behind it.

**Concrete decision: the CTA links to `/join` (no code in the URL). `/join` is a real route in the public app that renders the signup form directly, passing the generic code to the API; it does not redirect.**

| Route | Entry | `linkCode` sent to `POST /api/public/support-signup` |
|---|---|---|
| `/join` | Landing page CTAs, ads, generic sharing | The generic code, read from env on the public app |
| `/join/{code}` | Personal recruiter links and QR codes | `{code}` from the path |

Both render the same form component. The only difference is which code is submitted.

Why render rather than 307-redirect to `/join/{code}`:

1. A redirect costs a round-trip on the highest-intent click on the page.
2. It would put the generic code in the address bar, where it looks like a personal code and invites copying, sharing, and tampering.
3. It creates two canonical URLs for identical content — an avoidable SEO duplicate on a page whose whole job is to rank and convert.

The code value comes from a **public** env var on the `public-landing` service (`NEXT_PUBLIC_GENERIC_JOIN_CODE`), not a source constant, so the campaign can rotate or deactivate the generic link without a code change. It is deliberately not treated as a secret — it is a public link code by definition, and the browser posts it to the API. Keeping it out of the address bar is a UX and hygiene choice, not a security control, and should not be described as one.

If the env var is missing or the generic link is inactive, the CTA must still render and `/join` must show the standard Hebrew "הקישור אינו פעיל" state from the sibling spec's error handling — never a broken button and never a stack trace.

**Every CTA on this page targets `/join`.** There are three CTA moments (§5.1, §5.6, §5.7) plus the nav button, and none of them lead anywhere else. The volunteer band (§5.6) also targets `/join`, because the volunteer question is asked *inside* that flow (sibling spec, decision 6) — there is no second form to build.

## 5. Section plan, top to bottom

Copy below is either lifted from the live site (marked **[live]**) or written as connective tissue in the same voice (marked **[connective]**). No connective line makes a factual claim about the movement, its policy, or its people that is not already on the live site. Every **[connective]** string needs product-owner sign-off before launch.

### 5.0 Sticky nav — 64px

- **Purpose:** wayfinding plus a persistent path to the CTA.
- **Layout:** logo mark (start edge, i.e. right in RTL) · nav labels · primary CTA button (end edge). Height 64px, ground `--canvas`, bottom hairline per §3.6. Below 768px the labels collapse into the sheet of §3.7 and the CTA button stays visible in the bar — it never hides behind a hamburger.
- **Labels [live]:** `הנבחרת` · `רוצה להתנדב` · `צור קשר`. All are in-page anchors; there are no other pages in v1.
- **CTA label [live-derived]:** `הצטרפו אלינו`.
- **Tokens:** Label type, 12px radius on the button, `--accent-cta` fill. This is the CTA's home viewport-by-viewport, which makes the one-accent rule easy to enforce: if a section below also shows an accent button while the nav is on screen, the section's button is the one that gives way (see §5.6).

### 5.1 Hero

- **Purpose:** state what this is and convert in one screen.
- **Pattern source:** GoFundMe centered hero.
- **Content:**
  - Full lockup logo (`amchaisrael-logo-lockup.svg`), centered, max-width 420px.
  - Display: `הקמנו תנועה לאומית ימנית חדשה` **[live]**
  - Subheading: `הצטרפו אלינו ותנו לנו את הכח להילחם למענכם` **[live]**
  - Primary CTA → `/join`, label `אני מצטרף/ת` **[connective, derived from the sibling spec's "אני תומך/ת" CTA language]**
  - Below the button, Caption: `הרשמה בפחות מדקה · שם, טלפון ועיר בלבד` **[connective]** — this is factually grounded in the sibling spec's three-field form and earns its place by removing the reader's main hesitation before they click.
- **Tokens:** `--canvas` ground, 128px block padding, Display + Subheading, one accent moment (the button). No hero image, no gradient wash, no motion.

### 5.2 Mission band

- **Purpose:** the movement's core claim, given room to land.
- **Pattern source:** GoFundMe's editorial band between hero and grid.
- **Content:** Heading-sized pull quote, centered, ≤65ch: `הכיסא לא מעניין אותנו, העם מעניין אותנו` **[live]**, attributed beneath with `amchaisrael-ofer-winter-signature.png` (the live site's own signature graphic, real asset now in the repo) instead of typeset Label text — the signature is more credible than a name in a font, and it's the same choice the source site already made.
- **Tokens:** `--canvas-warm` ground (one of only two uses on the page), `--text-primary`, 96px block padding, hairlines above and below. **No accent color in this band at all** — the quote carries it.

### 5.3 Who we are

- **Purpose:** the "about" beat between the claim and the people.
- **Content:** Heading `עַמְּךָ ישראל` **[live]** plus two Body paragraphs of **[connective]** copy restating, without extending, what the live site says: a new national right-wing movement, led by Ofer Winter, built to fight for the public rather than for position. Flagged for sign-off; do not let this section grow into invented policy.
- **Tokens:** `--canvas` ground, two-column ≥1024px / single below, 96px padding, zero accent.

### 5.4 הנבחרת — the lineup

- **Purpose:** the credibility beat. Faces do more than any paragraph here.
- **Asset reality check (supersedes the original ClassPass/LottieFiles per-member grid plan):** the live site does not have individually cropped member portraits. It has one asset — `amchaisrael-team-two-rows.png` (1080×703, retouched cutouts of 11 people, transparent background, front row overlapping back row) — the exact image already downloaded into `docs/features/leadMachine/reference/assets/`. This is a *composite*, not a grid source. The ClassPass/LottieFiles reference informed the original per-card plan; the actual asset overrides it.
- **Revised layout:** render the composite as one full-bleed image, not a CSS grid. Max-width matches the 1200px content column, centered, `object-fit: contain` so no figure is cropped. No card chrome, no hairline, no radius — the image's own transparent cutout edge is the boundary, exactly as the live site uses it.
- **Names/roles:** the composite carries no name/role data (`alt="הנבחרת שלנו"` only — no per-person alt). If the campaign supplies an ordered name/role list matching left-to-right, back-then-front position in the image, render it as a Caption-type legend row beneath the image. **Ship without the legend if that list doesn't arrive** — the photo alone still carries the credibility beat; do not invent names or guess positions from appearance.
- **Tokens:** `--canvas-alt` ground to alternate off §5.3, 96px block padding (single image, not a multi-row grid, so §5.3's 128px grid-band padding is oversized here).
- **No longer a blocking dependency.** The original "cut the section if photos are missing" rule is moot — the photo exists and is already in the repo.

### 5.5 למה להצטרף — optional benefit grid

- **Purpose:** answer "what does joining actually do."
- **Pattern source:** Miro nonprofit icon/benefit grid.
- **Layout:** three cards, 1px hairline, `8px` radius, `--surface` on `--canvas-alt`; a single-color line icon (`--brand-purple`, stroked, 24px) above Heading-sm above two lines of Body.
- **Status:** **conditional.** The live site supplies no three-benefit copy, so all of it would be **[connective]**, and connective copy on a political page is exactly where fabricated claims creep in. Ship this section only if the product owner supplies or approves the three claims. If they don't, cut it — §5.3 → §5.4 → §5.6 reads fine without it.

### 5.6 רוצה להתנדב — volunteer band

- **Purpose:** capture the higher-commitment visitor without building a second form.
- **Content:** Heading `רוצה להתנדב` **[live]**, one Body line of **[connective]** copy explaining that the volunteer question is part of the same short signup, and a CTA → `/join`.
- **Routing note:** deliberately the same destination. The sibling spec asks the volunteer yes/maybe/no question inside the flow and creates the `Task`/`TaskAssignment` from the answer. A separate volunteer form would duplicate a spec'd path for no gain.
- **Tokens:** `--canvas` ground. **This CTA renders as a secondary button** — transparent fill, 1px `--accent-cta` border, `--accent-cta` label — because the nav's filled CTA is on screen at the same time and §2's one-chromatic-moment rule has to hold at every scroll position, not just in a static mock.

### 5.7 Closing CTA

- **Purpose:** the last conversion moment, for readers who scrolled the whole page.
- **Pattern source:** GoFundMe's terminal CTA/signature block.
- **Content:** Display-size restatement `הצטרפו אלינו ותנו לנו את הכח להילחם למענכם` **[live]**, primary CTA → `/join`, and the logo mark beneath as a signature.
- **Tokens:** `--canvas-warm` ground (the second and last use), one filled accent button. The nav's CTA is the only other accent that can be on screen; at this section's height the nav CTA should fade to its outline variant on the same scroll listener that drives the hairline, so the rule holds. If that proves fiddly, the acceptable fallback is to keep the nav CTA filled and render this one as outline — but not both filled.

### 5.8 Footer

- **Purpose:** contact, social, legal. Nothing else.
- **Content:** logo mark · social icons (Facebook, Instagram, WhatsApp) **[live]** · `מדיניות פרטיות` · `הצהרת נגישות` **[live]** · copyright line.
- **Tokens:** `--brand-purple` ground with `--on-purple` text — the page's one large chromatic surface, placed where it can't compete with a CTA. Caption type, 64px block padding.
- **Hard rule:** no link to the management app, and no "כניסת רכזים"/"התחברות"/admin affordance of any kind. See §7.
- Privacy and accessibility pages are required by Israeli practice and are **not written in this spec** — see §9.

## 6. Accessibility

- Target WCAG 2.1 AA. All measured pairs in §3.1 clear it with margin.
- Every interactive element gets a visible focus ring: 2px `--accent-cta` outline at 2px offset. It is never removed, and because the page has no shadows, the ring is the only focus signal — treat it as load-bearing.
- Full keyboard path: nav → each CTA → footer, in DOM order, which in RTL is still logical order.
- Real landmarks (`header`/`nav`/`main`/`footer`), one `h1` (§5.1's display line), no heading-level skips.
- Team photos take descriptive Hebrew `alt` (name and role), not empty alt.
- Motion honors §3.7's reduced-motion behavior; contrast honors §3.6's `prefers-contrast` step.
- An accessibility statement page is legally expected in Israel — flagged in §9, not specified here.

## 7. Navigation rule — outbound only

**The relationship is one-way by design.**

**Management app → public page (requires approval).** The management app gains a link/button in its own navigation pointing out to the public landing page's domain. This touches a LOCKED dashboard screen and therefore **requires explicit user approval on the specific screen before implementation** — the same precedent and the same gate the sibling spec already applies to its "get my personal link + QR" control (sibling §"Permissions and locked screens"). Both controls are nav-adjacent and should be approved together, in one decision, rather than as two separate interruptions.

**Public page → management app: never.** Concretely:

- No link, button, or menu item pointing at the management domain.
- No admin/coordinator/login affordance of any kind, including hidden or footer-only ones.
- No asset hotlinked from the management domain — a logo or font served from that host leaks the hostname in the network panel just as effectively as a link would.
- No shared analytics property, tag manager container, or error-reporting DSN that names or resolves to the management host.
- No mention of the internal app in copy, error states, `robots.txt`, sitemap, or HTML comments.

**Resolved: same-origin proxy.** The gap above is fixed. The sibling spec now routes every browser-facing call through the public app's own server (`/api/proxy/*`), which relays server-to-server to the management app's `/api/public/*` with a shared-secret header — the management app's origin is never visible to the browser, devtools, or DNS/CT logs from this page. See `docs/features/leadMachine/2026-08-26-supporter-self-signup-design.md` §"Same-origin proxy" for the full mechanism, including how it preserves per-IP rate limiting across the extra hop (`X-Original-Client-IP`, trusted only with a valid secret).

## 8. Assets

**Present in the repo** — `docs/features/leadMachine/reference/assets/`:

| File | Use |
|---|---|
| `amchaisrael-logo-mark.svg` | Nav, §5.7 signature, footer. **Correction from an earlier draft of this spec:** this is a compact horizontal wordmark (viewBox 257×50, ≈5.1:1), not a square icon — do not render it in a 1:1 box. Gradient `#3685E3` → `#8F36BF`, preserved as-is. Render at a fixed height (28px nav/signature, 24px footer) with `width: auto`, never a forced square. |
| `amchaisrael-logo-lockup.svg` | §5.1 hero only, max-width 420px, viewBox 945.8×227.5 (≈4.16:1) — includes the `בראשות עופר וינטר` sub-lockup. Also not square; keep `height: auto` on the rendered element. |
| `amchaisrael-team-two-rows.png` | §5.4, full-bleed composite, 1080×703 source. **Real asset — pulled from the live site, not a placeholder.** |
| `amchaisrael-ofer-winter-signature.png` | §5.2 attribution, 2048×1152 source (scales down cleanly). |
| `amchaisrael-og-share-image.jpg` | Candidate source for the OG/share image below — 1200×675, 25px short of the standard 1200×630, needs a light crop, not a redesign. |

All five are pulled directly from the live site's own production build (`amchaisrael.co.il`), not recreated or approximated. All are served from the public app's own `/public` directory, none hotlinked (§7). Each needs an accessible name, and where decorative (footer, §5.7 signature mark), `aria-hidden` with the name carried by adjacent text.

**Still needed:**

- **Per-member name/role list for §5.4's optional legend.** The photo itself is unblocked; only the caption data is outstanding, and the section ships correctly without it.
- **Open Graph / social share image**, needed before any link is shared to WhatsApp or Facebook (the movement's primary distribution channel per the live site's own footer). `amchaisrael-og-share-image.jpg` is a strong starting candidate — same brand, same photography — but confirm with the campaign whether reusing their existing share image as-is is acceptable or whether this page wants its own crop/message before treating this item as closed.
- **Favicon set** derived from the logo mark — `amchaisrael.co.il`'s own `favicon-512.png` exists on the live site and was not pulled in this pass; a one-line addition if wanted.

No stock photography. No AI-generated imagery of people. On a real political movement's page, either is a credibility failure and, for AI imagery of real or apparent people, an integrity one.

## 9. What is *not* decided here

- **Dark mode.** Deferred with a stated blocker (§3.1): `--accent-cta` measures 3.17:1 on the brand's dark ground, so a dark theme needs a lightened CTA variant and a re-picked border value, not a media query.
- **§5.5's three benefit claims** — conditional on product-owner-supplied copy. Cut the section if it doesn't arrive.
- **All [connective] copy** in §5.1, §5.3, §5.5, §5.6 needs product-owner sign-off. Nothing in it makes a new factual claim, but a political page's words are the client's, not ours.
- **`שלט למרפסת` (balcony-sign merch)** exists on the live site and is **out of scope for v1** — it implies commerce, fulfilment, and payment, none of which this app has. Its own spec if wanted.
- **Privacy policy and accessibility statement page content.** Both are expected in Israel; both are legal/content deliverables, not design ones. The footer links exist; the pages do not.
- **The public app's actual domain** — still open in the sibling spec; unchanged here. It affects the OG image's URL and the management app's outbound link target.
- **Analytics.** Whether the page gets any measurement at all, and if so which tool, is undecided. Constraint from §7: it cannot share a property with the management app.
- **Localization.** Hebrew only, matching the rest of the platform. No Russian or Arabic variant is planned; raising one would be a new spec.
