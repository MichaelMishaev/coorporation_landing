---
name: push-dev
description: Push already-committed local `develop` commits to the dev Railway deployment (coorporation-landing-dev, https://coorporation-landing-dev-development.up.railway.app) for this repo (coorporation_landing). Trigger on "push to dev", "deploy the dev site", "push coorporation-landing-dev", "ship this to the dev landing page". Never push `main`/production as part of this skill.
---

# Push the dev landing site

Branch-to-environment mapping for this repo:

| Branch | Railway service | URL |
|---|---|---|
| `develop` | `coorporation-landing-dev` (development env) | `coorporation-landing-dev-development.up.railway.app` |
| `main` | `coorporation-landing` (production env) | `amach.rbac.shop` |

Both services auto-deploy on push to their branch — no CI, no manual deploy step. Until this was fixed, both services watched `main`, so any push deployed to prod and dev at once; they are now correctly split, but that history is exactly why the check below is mandatory every time, not just the first time.

**Hard rule: this skill may push only commit(s) already on local `develop` to `origin/develop`.** If the current branch is `main`, any feature branch, or detached HEAD, stop — do not check out or create `develop` yourself, and do not push. `main` deploys production (`amach.rbac.shop`), not the dev site; pushing the wrong branch there is a live-prod incident, not a mistake you can quietly fix after. Never `git push origin main`, never `--force`, never an implicit/upstream-inferred push — always the explicit `git push origin develop`.

## 1. Verify the push destination (fast — a few seconds)

Run these in order and stop at the first failure:

```bash
cd /Users/michaelmishayev/Desktop/Projects/coorporationLanding
git fetch origin --quiet
git branch --show-current                                    # must print exactly: develop
git remote get-url --push origin                              # must be git@github.com:MichaelMishaev/coorporation_landing.git
git rev-list --left-right --count origin/develop...develop    # left = commits you're missing, right = commits ready to push
```

- Branch isn't exactly `develop` → **stop**, tell the user, do not switch branches for them.
- Remote doesn't match → **stop**, this isn't the repo you think it is.
- Left count > 0 (local is behind `origin/develop`) → **stop**, do not push over unseen remote commits; tell the user to pull/rebase first.
- Right count is 0 → nothing to push, say so and stop; this is not a failure.

## 2. Inspect local changes, don't touch them

```bash
git status --short
```

This repo routinely has unrelated in-progress work sitting dirty in the working tree (other features, assets, doc edits). Report what's uncommitted for the user's awareness — **never** `git add -A`, `git commit -a`, or otherwise sweep dirty files into what you push. This skill pushes commits that already exist on `develop`; it does not create new ones. If the user wants specific files committed first, that's a separate, explicit step they ask for by naming the files.

## 3. Run the fast release checks

```bash
npm run lint && npm run build
```

No test suite exists in this repo — lint + a production build are the fastest checks that actually catch something (build failures, Next.js compile errors). Don't invent a browser pass, screenshot check, or manual QA step here; that's what `view-landing` is for, separately, if the user wants it. Either command failing → **stop**, report the failure, do not push a build that doesn't compile.

## 4. Push

```bash
git push origin develop
```

Exactly this — no `--force`, no `HEAD:develop` shorthand that could silently push the wrong local ref, no touching `main`.

## 5. Report

Tell the user: the commit SHA(s) just pushed, and that Railway will auto-deploy `coorporation-landing-dev` from `origin/develop` — link `https://coorporation-landing-dev-development.up.railway.app`. Deploys aren't instant; don't claim it's live without checking (Railway's dashboard or the URL itself) if the user asks for confirmation, not just that the push succeeded.

## What this skill does NOT do

- Does not stage, commit, or amend anything — only pushes commits that already exist on `develop`.
- Does not touch `main`, and does not promote `develop` → `main` (production release is a separate, explicit request).
- Does not force-push, rebase, or rewrite history.
- Does not change Railway service/branch wiring — that's infrastructure config, not a code push.
- Does not run `view-landing`'s browser check — pushing and visually verifying are separate asks.
