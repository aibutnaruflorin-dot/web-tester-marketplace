---
name: test-verify
description: >-
  Audits the Playwright specs that test-write produced — before they ever run —
  to catch fragile selectors, weak assertions, anti-patterns, missing
  unhappy-path coverage, and leaked secrets. Use this skill after specs are
  written, or whenever the user wants to "verify the tests", "review the specs",
  "audit the tests", "check the tests", "verifică testele", "controlează
  testele", or wants a second pass on spec quality before running anything. It
  reads tests/ and docs/test-plan.md, writes docs/test-review.md with findings,
  auto-fixes minor issues, and flags major ones for the user.
---

# Verify Tests

This skill is the quality gate between writing and running. It re-reads every
spec, scores it against a fixed checklist, fixes the small problems on the spot,
and flags the structural problems back to the user. Running a suite of bad
tests is worse than running none: green bad tests build false confidence; red
bad tests waste triage time. This phase prevents both.

## When to use this

Run this after `test-write`, before `test-run`. It can also run standalone when
the user has hand-edited specs and wants an audit pass, or when an old suite
starts producing flaky results and needs a structural review.

## Inputs and outputs

- **Reads:** every file under `tests/`, `playwright.config.ts`, `.env.example`,
  `docs/test-plan.md`, `docs/test-state.md`.
- **Writes:** `docs/test-review.md` with the findings. Edits spec files
  directly for auto-fixable issues.
- **Updates:** `docs/test-state.md` (marks Verify done).

## The checklist

Run each spec file through these checks. Each item lists what to look for, what
counts as auto-fixable, and what to flag.

### A. Selectors

- **A.1** No raw CSS selectors for interactive elements
  (`page.locator(".btn-primary")`, `page.locator("#submit")`,
  `page.locator("div > button:nth-child(2)")`).
  - *Auto-fix:* swap to `getByRole`, `getByLabel`, `getByText`, or
    `getByPlaceholder` where the intent is obvious from the surrounding
    assertion or the rendered HTML.
  - *Flag:* if the element truly has no accessible name, ask the user whether
    to add one to the app (better) or accept a `data-testid` (acceptable).
- **A.2** No XPath selectors. Same fix as A.1.
- **A.3** No text matches that depend on copy that will change every release
  ("Welcome back, John!"). Prefer roles + partial regex.

### B. Assertions

- **B.1** Every `test()` block has at least one `expect(...)` on an
  **observable outcome** (visible text, URL, count, value), not just
  `toBeVisible()` on the element that was just clicked.
  - *Flag:* a test with no real assertion.
- **B.2** No `expect(true).toBe(true)`, `expect(1).toBe(1)`, or similar
  no-op assertions.
  - *Auto-fix:* delete them.
- **B.3** No commented-out assertions (`// expect(...)`).
  - *Auto-fix:* delete; ask the user only if there is a `TODO` next to it.

### C. Waits and timing

- **C.1** No bare `page.waitForTimeout(...)` / `await page.waitFor(<ms>)` /
  `setTimeout`. These are the #1 source of flakiness.
  - *Auto-fix:* replace with `await expect(locator).toBeVisible()` /
    `toHaveText` / `toHaveURL` on the thing the test was actually waiting for.
  - *Flag:* if it is not obvious what the test was waiting for, surface it.
- **C.2** No `waitForLoadState("networkidle")` as a substitute for a real
  assertion. It is unreliable on apps with long-polling or analytics.
  - *Flag:* recommend a specific assertion on the user-visible state.

### D. Coverage of the plan

- **D.1** Every critical path in `docs/test-plan.md` has a matching test
  (search spec files for path names or their key actions).
  - *Flag:* missing critical paths — this is the most important finding.
- **D.2** Every form tested has at least one unhappy-path test (empty
  submit, invalid input, or wrong credentials).
  - *Flag:* surface and offer to add a stub.
- **D.3** Smoke spec exists if smoke was in the plan's scope; the same for
  a11y, visual, and API.
  - *Flag:* missing scope coverage.

### E. Isolation and side effects

- **E.1** No test depends on another test having run first (no shared
  mutable state across `test()` blocks). Playwright runs tests in parallel.
  - *Flag:* if found, recommend `test.describe.configure({ mode: "serial" })`
    only for genuinely ordered flows.
- **E.2** No test creates data without cleaning it up — or, if cleanup is
  hard, no test relies on a clean DB at the start.
  - *Flag:* this is hard to auto-fix; surface it.

### F. Secrets and config

- **F.1** No literal passwords, API keys, tokens, or production URLs in
  spec files. Credentials must come from `process.env.*`.
  - *Auto-fix:* move literals to `.env.example` placeholders and replace the
    use site with `process.env.X`.
  - *Flag:* refuse to continue if a real-looking secret is found in a spec.
- **F.2** `baseURL` in `playwright.config.ts` should default to a safe value
  (the plan's target) and allow override via `process.env.BASE_URL`.

### G. Playwright config

- **G.1** `reporter` includes `html` so `test-run` can capture a report.
- **G.2** `trace: "on-first-retry"`, `screenshot: "only-on-failure"`,
  `video: "retain-on-failure"` are present.
- **G.3** If the plan declares auth, `globalSetup` and `storageState` are
  wired and `tests/global-setup.ts` exists.
- **G.4** If embedded mode, `webServer` block is present with the start
  command from the plan.
- **G.5** Browser projects match what the plan requested — no rogue browsers
  added, no requested browser missing.

## Workflow

### 1. Load the inputs

Read the plan, the state file, the config, every spec under `tests/`, and
`.env.example`. Build a mental map of what the suite claims to cover.

### 2. Run the checklist

Walk each spec file through sections A–G. Keep two lists:

- **Auto-fixed** — what you edited, with a one-line note per change.
- **Flagged** — what needs the user's input or a code change in the app
  itself, with the file, line, and what to do about it.

When auto-fixing, prefer the smallest change that fixes the issue. Do not
refactor a working spec under the cover of "verification".

### 3. Write docs/test-review.md

```markdown
# Spec Review — <Project / URL>

- **Date:** <YYYY-MM-DD>
- **Specs reviewed:** <N files, M tests>

## Summary
- Auto-fixed: <count> issues across <files>
- Flagged for user: <count> issues
- Coverage vs plan: <Complete | Missing: <list>>

## Auto-fixed
- `tests/<file>.spec.ts:<line>` — <one-line description>
- ...

## Flagged
- **<severity: blocker | major | minor>** — `tests/<file>.spec.ts:<line>` — <what is wrong, why it matters, what to do>
- ...

## Coverage Gaps vs the Plan
- <critical path or scope category missing> — <suggested test to add>

## Verdict
<Ready to run | Needs the flagged issues addressed first>
```

### 4. Decide whether the suite is run-ready

- **No blockers** — mark Verify done in `docs/test-state.md` and tell the
  user the suite is cleared to run. Hand off to `test-run`.
- **Blockers present** — do **not** advance. Show the user the blockers,
  explain why each blocks running (a leaked secret, a missing critical-path
  test that the whole report depends on, a structural issue like every test
  using `waitForTimeout`), and ask whether they want you to fix them now or
  go back to `test-write` for a regeneration.

### 5. Update state

When you do advance, mark `- [x] 3. Verify — docs/test-review.md` in
`docs/test-state.md` and bump the "Last updated" date.

## Principles

- **A green run of bad tests is worse than a red run of good ones.** This
  phase exists to prevent the former.
- **Auto-fix the boring, flag the structural.** Selectors and sleeps are
  mechanical; missing coverage and shared-state bugs need judgement.
- **Verify against the plan, not against your taste.** If the plan says
  "smoke only, no unhappy paths", do not flag missing unhappy-path tests.
- **Refuse on leaked secrets.** No exceptions. A real password in a spec
  blocks the pipeline until it is removed.
