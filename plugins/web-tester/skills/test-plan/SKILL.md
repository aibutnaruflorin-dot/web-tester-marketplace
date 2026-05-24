---
name: test-plan
description: >-
  Gathers and documents what to test on a website or web app by interviewing the
  user, then writes a structured test plan. Use this skill at the start of any
  testing job — whenever the user wants to "plan tests", "decide what to test",
  "scope the testing", "set up a test plan", "plan ce să testez", "stabilim
  scope-ul de testare", or describes a page/URL they want covered, even with only
  a vague idea. Always run this before any specs are written. It captures the
  target URL, the test scope (smoke / E2E / regression / API / accessibility /
  visual), the critical user paths, and the test accounts; auto-detects whether
  the toolkit is running embedded in an app project or standalone against a
  remote URL; and produces docs/test-plan.md plus the shared docs/test-state.md
  tracker.
---

# Test Plan

This skill turns a fuzzy request ("test my site") into a concrete written plan
that every later phase — write, verify, run, triage — builds on. A good plan
is the cheapest insurance against rework: it locks down *what* is being tested
and *why* before a single spec is written.

## When to use this

Run this first, before any specs. Even if the user jumps straight to "scrie
testele", start here — a short interview saves hours of testing the wrong
thing. If a `docs/test-plan.md` already exists, read it and offer to refine it
instead of starting over.

## Pipeline conventions (shared by all phase skills)

Every testing job lives in one project folder. Cross-phase artifacts live in a
`docs/` subfolder so each skill can find what the previous one produced:

- `docs/test-plan.md` — what gets tested (this skill writes it)
- `docs/test-review.md` — quality audit on the written specs (the `test-verify` skill writes it)
- `docs/test-report.md` — triaged final report (the `defect-review` skill writes it)
- `docs/test-state.md` — a progress tracker every skill reads and updates

Test code lives at the project root in `tests/` plus `playwright.config.ts`.

## Workflow

### 1. Locate the project folder and detect the mode

Ask the user where the testing job should live (or confirm the current folder).
Create the folder and a `docs/` subfolder inside it.

Detect the **mode** automatically by looking at the project root:

- If a `package.json`, `src/`, `app/`, `pages/`, `next.config.*`, `vite.config.*`,
  or similar application code exists → **embedded mode**. Tests will live next
  to the app code and `playwright.config.ts` will start the local dev server
  via its `webServer` block.
- Otherwise → **standalone mode**. The toolkit will scaffold a tests-only
  project that hits a remote URL given by the user; no `webServer` block.

Record the mode in `docs/test-state.md` — `test-write` branches on it.

### 2. Interview the user

The goal is a complete picture, gathered with as little friction as possible.
First, mine what the user already said — if they described the target, extract
answers from it and only ask about the gaps. Then fill the gaps:

- Use the **AskUserQuestion tool** for anything with a small set of clear
  choices (scope categories, browser matrix, has-login yes/no). Batch related
  questions so the user answers several at once.
- Ask **open questions in plain conversation** for things that need a sentence
  — the target URL, the one-line purpose of the site, the critical user paths.

Cover every topic below. Do not skip ahead to writing the plan until each is
answered or explicitly marked "decide for me / use a sensible default".

1. **Target** — the URL to test (in standalone mode), or the local dev server
   URL and command to start it (in embedded mode, e.g. `npm run dev` on
   `http://localhost:3000`).
2. **Purpose** — what the site or page is *for*, in one line. This is what
   "the critical path" means — the single most important visitor action.
3. **Test scope** — which categories the user wants in this run. Ask via
   AskUserQuestion, multi-select:
   - **Smoke** — page responds, no console errors, key elements render. Quick
     gate, runs fast.
   - **E2E (user journeys)** — the critical paths through the UI: login,
     form submit, checkout, search, etc. The core of any Playwright suite.
   - **Regression** — pins down current behavior so future changes do not
     silently break it. Practically = smoke + E2E run in CI.
   - **API / backend** — endpoints called directly via Playwright's `request`
     fixture (status codes, schemas, auth, error responses).
   - **Accessibility (a11y)** — axe-core scans on the key pages (WCAG rule
     violations).
   - **Visual** — screenshot snapshots compared against a baseline (catches
     unintended layout changes).
4. **Critical user paths** — the 2–5 journeys that *must* work. Examples:
   "land → click 'Programare' → fill form → see confirmation"; "login →
   add to cart → checkout → see receipt". A plan with no critical paths is
   not a plan.
5. **Authentication** — does the app have a login? If yes:
   - Where is the login form (URL + element labels)?
   - What test account credentials should the suite use?
   - Record that the suite will use `.env` + `storageState.json` (see the
     auth section below) — do **not** record actual passwords in the plan.
6. **Browsers** — Chromium only (default and recommended), or also Firefox
   and WebKit? Multi-browser triples runtime; pick it only if the user has a
   real reason.
7. **Viewports** — desktop only, or also mobile? Default is both.
8. **Constraints** — anything in scope that needs special handling: rate
   limits, third-party services (Stripe sandbox, captcha), data setup, a
   staging environment that resets nightly.
9. **Out of scope** — what the user explicitly does *not* want tested in this
   run. Just as important as the in-scope list.

### 3. Authentication: how it will be wired

If the app has a login, the toolkit always uses the same pattern — record this
in the plan so the user knows what `test-write` will produce:

- A `.env` file at the project root holding `TEST_USER_EMAIL` and
  `TEST_USER_PASSWORD` (and any additional accounts). The `.env` stays in
  `.gitignore`; a `.env.example` template is committed instead.
- A `tests/global-setup.ts` that logs in once at suite start and saves the
  authenticated browser context to `tests/storageState.json`.
- Each spec loads that storage state via `playwright.config.ts` so it starts
  already logged in. No spec ever types a password.

Tell the user to fill in `.env` after `test-write` runs.

### 4. Write docs/test-plan.md

Use this template exactly so later skills can rely on the structure:

```markdown
# Test Plan — <Project / URL>

## Summary
<2-3 sentences: what is being tested, against which target, with what scope.>

## Target
- **URL:** <https://… or http://localhost:3000>
- **Mode:** <embedded | standalone>
- **Start command (embedded only):** <e.g. `npm run dev`>

## Scope
- [x] Smoke
- [x] E2E
- [ ] Regression
- [ ] API
- [ ] Accessibility
- [ ] Visual
<check the boxes the user picked>

## Critical User Paths
1. <Name> — <step 1 → step 2 → step 3 → observable outcome>
2. ...

## Authentication
<no login | login at <URL>; uses .env + storageState.json; accounts: <role>>

## Browsers & Viewports
- Browsers: <chromium | chromium + firefox + webkit>
- Viewports: <desktop | desktop + mobile>

## Constraints & Special Handling
<rate limits, third-party services, data setup, staging quirks>

## Out of Scope
<things explicitly NOT being tested>
```

### 5. Create docs/test-state.md

Create the shared tracker that every later skill updates:

```markdown
# Test State — <Project / URL>

- **Target:** <URL or local dev server>
- **Mode:** <embedded | standalone>
- **Scope:** <smoke, e2e, regression, api, a11y, visual>
- **Created:** <YYYY-MM-DD>
- **Last updated:** <YYYY-MM-DD>

## Pipeline
- [x] 1. Plan — docs/test-plan.md
- [ ] 2. Write — tests/
- [ ] 3. Verify — docs/test-review.md
- [ ] 4. Run — test-results/
- [ ] 5. Triage — docs/test-report.md

## Notes
<anything later phases must know>
```

### 6. Confirm and hand off

Show the user a short summary of the plan (target, scope checkboxes, critical
paths) and ask them to confirm or correct it. Once confirmed, tell them the
next phase is `test-write`, which will produce the specs and pause for their
review before anything runs.

## Principles

- **Ask, don't assume.** A wrong assumption recorded in the plan propagates
  into every spec. When the user is unsure, offer a sensible default and mark
  it as an assumption in the plan.
- **Critical paths over coverage breadth.** Three meaningful end-to-end tests
  of the journeys the business depends on beat fifty trivial ones.
- **Out-of-scope is as valuable as in-scope.** It is what stops a smoke run
  from quietly turning into a full regression suite.
- **Never put real credentials in the plan.** The plan names *what* logs in;
  `.env` holds *how*.
