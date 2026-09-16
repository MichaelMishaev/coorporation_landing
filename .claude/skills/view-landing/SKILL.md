---
name: view-landing
description: Launch this app (the עמך ישראל landing page + supporter signup flow) locally and view it in a browser to see current state or verify a change. Read-only — never edit, create, or delete any file in this repo as part of this skill. Trigger on "show me the landing page", "view the app", "see the signup flow", "screenshot the landing page", "check what it looks like now".
---

# View the landing + signup app

This repo (`coorporation-landing`) is a pure frontend: no database, no auth,
no backend of its own. This skill starts it locally and looks at it — it
never modifies app code, styles, content, or config.

**Hard rule: this skill is view-only.** If something looks broken or worth
fixing while using it, report it and stop — do not edit any file in this
repo unless the user explicitly says to go ahead on that specific change in
that message. This applies even to obvious-looking fixes.

## 1. Check for an already-running dev server

```bash
lsof -nP -iTCP:3387 -sTCP:LISTEN
```

If something's already listening on 3387, skip straight to step 3 — don't
start a second instance. If you need to confirm it's actually this repo's
server (not something else that happened to grab the port), check the
process's working directory:

```bash
lsof -a -p <PID> -d cwd -Fn
```

## 2. Start the dev server (only if nothing is listening on 3387)

```bash
cd /Users/michaelmishayev/Desktop/Projects/coorporationLanding
npm run dev
```

Run this in the background and wait for `Ready` in its output before
navigating — don't guess a fixed sleep. `.env.local` may not exist in this
repo yet (see `.env.example`); the app still renders without it — only the
`/join` flow's calls to the (not-yet-built) management-app backend will
fail, which is expected. That failure surfaces as a clean "הקישור אינו פעיל"
state, not a crash — do not treat that message as a bug during a view-only
check.

## 3. Open it in the browser

Use the claude-in-chrome tools (load them via ToolSearch first if deferred:
`tabs_context_mcp`, `navigate`, `computer`, `tabs_create_mcp`,
`tabs_close_mcp`).

- Landing page: `http://localhost:3387/` — scroll through hero, mission
  band, who-we-are, lineup (team photo), volunteer band, closing CTA,
  footer.
- Signup form: `http://localhost:3387/join` — will show "הקישור אינו פעיל"
  until `NEXT_PUBLIC_GENERIC_JOIN_CODE` is set and the management-app
  backend exists. That's the expected current state, not something to fix
  here.
- `http://localhost:3387/join/<any-code>` behaves the same way for a
  personal-link URL shape.

Take screenshots at both desktop and mobile widths if the user wants a full
look — use `resize_window` before screenshotting for mobile.

## 4. Close tabs you opened

Per the standard claude-in-chrome rule: close any tab you created for this
check once you're done, unless the user asked to keep it open.

## What this skill does NOT do

- Does not run `npm run build`, `npm run lint`, or any check that could be
  confused for a change-verification pass — this is for *looking*, not
  validating.
- Does not touch `docs/`, `public/`, or any component file.
- Does not commit, stage, or otherwise touch git state in this repo.

If the user wants an actual change made after viewing, that's a separate,
explicit request — this skill's job ends at "here's what it looks like now".
