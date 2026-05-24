---
name: defect-review
description: >-
  Triages every failure from a Playwright run — separates real bugs in the
  product from flaky tests and from wrong tests, recommends the next action for
  each, and writes the final test report. Use this skill after the suite has
  run, or whenever the user wants to "triage failures", "review defects",
  "analyze what failed", "triază defectele", "vezi ce a picat", or wants a
  written test report. It reads test-results/, playwright-report/, tests/,
  docs/test-plan.md, and docs/test-state.md; writes docs/test-report.md;
  closes the pipeline.
---

# Defect Review

This skill is the closing phase. It takes the raw output of `test-run` and
turns it into actionable signal: each failure classified, each one mapped to a
recommended next step, and a single Markdown report the user can hand to a
developer or to themselves the next morning. A failing suite is only useful
if someone knows *which* failures are worth chasing.

## When to use this

Run this after `test-run`. It can also run standalone if the user already has
a `test-results/` folder from a previous run and wants a triage pass without
re-running.

## Inputs and outputs

- **Reads:** `test-results/` (per-test traces, screenshots, error snapshots),
  `playwright-report/` (the HTML report), every spec under `tests/`,
  `docs/test-plan.md`, `docs/test-state.md`, `docs/test-review.md` (the
  earlier audit may already flag suspect tests).
- **Writes:** `docs/test-report.md` — the final report.
- **Updates:** `docs/test-state.md` (marks Triage done).

## The three classifications

Every failure is exactly one of these. Pick the most likely one based on the
evidence, and say *how confident* you are.

### Real bug (in the product)

The test is well-written, it tests something the plan says matters, and the
product is genuinely not doing it.

- **Evidence:** the error message describes a real product behavior failing
  (a 500 from the server, a missing UI element that the spec exists *to*
  check, a wrong value rendered, an unhandled exception in
  application code visible in the trace).
- **Recommended action:** fix the product. Link to the failing test, the
  trace, and (when possible) the file in the product that needs changing.

### Flaky (intermittent / environment / timing)

The test fails on some runs and passes on others, or it failed on this run
because of something outside the product's behavior.

- **Evidence:** the failure mode is timing-related (`waited for selector to
  be visible`, `timeout`), Playwright marked it as flaky (failed then passed
  on retry), the trace shows the page eventually rendered correctly just
  past the timeout, the error references a third-party service or network.
- **Recommended action:** depends on cause —
  - True timing: tighten the assertion to wait for the right element /
    state. Recommend the fix in the report; do not silently apply it (the
    user wanted a triage pass, not a rewrite).
  - Network / third-party flake: recommend a retry policy bump or mocking
    that dependency.
  - Environment: recommend the environment fix.

### Wrong test (the spec itself is broken)

The test fails because the spec was written incorrectly, not because the
product is wrong.

- **Evidence:** the selector targets an element that does not exist in the
  current UI and never did; the assertion expects text the design never
  promised; the test depends on data that is not seeded; the spec was
  written against an old version of the page.
- **Recommended action:** rewrite the spec. Refer back to `test-write` and,
  if the underlying plan is also out of date, back to `test-plan`. Be
  honest in the report — wrong tests are not bugs, and counting them as
  bugs misleads the user.

## Workflow

### 1. Load the run output

Read `docs/test-state.md` (it has the pass/fail counts from `test-run`),
`docs/test-plan.md` (so each failure can be mapped to a critical path or
scope category), `docs/test-review.md` (it may have pre-flagged risks), and
the contents of `test-results/`.

For each failure, the most informative artifacts are:

- The error message and stack from the test runner output (in
  `test-results/<id>/`, look for `error-context.md` or the structured
  error in the test summary).
- The trace file (`trace.zip` if present) — open with
  `npx playwright show-trace test-results/<id>/trace.zip` when more detail is
  needed.
- The failure screenshot (`test-failed-1.png`) — often enough on its own.
- The video (`video.webm`) — useful for journey failures.

### 2. Triage each failure

For each failed test:

1. **Identify the assertion that failed** — read the error line.
2. **Look at the screenshot** — what was on the page at the moment of
   failure?
3. **Cross-reference the spec** — is the assertion testing something the
   plan asked for? Is the selector reasonable?
4. **Classify** — real bug / flaky / wrong test, with a confidence
   (high / medium / low).
5. **Recommend a single concrete next action** — fix the product (point at
   what), fix the spec (point at what), or fix the environment.

If multiple failures share a root cause (one auth bug fails 12 tests; one
broken selector fails 4), say so and group them — do not list the same
finding 12 times.

### 3. Note the flakies separately

Tests Playwright marked as flaky (passed on retry) get their own short
section. They are not failures, but they are debt — explain why each was
flaky and what would make it not flaky.

### 4. Write docs/test-report.md

```markdown
# Test Report — <Project / URL>

- **Date:** <YYYY-MM-DD>
- **Target:** <URL or local dev server>
- **Scope:** <smoke, e2e, regression, api, a11y, visual>
- **Browsers:** <chromium-desktop, ...>
- **Result:** <P passed / F failed / K flaky / S skipped>

## Summary
<2-3 sentences: how the suite went, the biggest single finding.>

## Real Bugs Found
- **<short title>** — `tests/<file>.spec.ts:<line>` — Critical path: <name from plan>.
  - What happened: <one-line summary from the trace / screenshot>
  - Likely cause: <where in the product>
  - Fix: <concrete next step>
- ...

## Flaky Tests (passed on retry — still debt)
- **<test name>** — `tests/<file>.spec.ts:<line>`
  - Why it was flaky: <timing / network / environment>
  - Recommended fix: <specific change to the spec>

## Wrong Tests (spec itself is broken)
- **<test name>** — `tests/<file>.spec.ts:<line>`
  - What is wrong with the spec: <one line>
  - Recommended rewrite: <or refer back to test-write>

## Scope Coverage
- Critical paths covered: <N of M from the plan>
- Missing or not run: <list>

## How to Re-run
\`\`\`
npx playwright test
npx playwright show-report
\`\`\`

## Artifacts
- HTML report: `playwright-report/index.html`
- Traces / screenshots / videos: `test-results/`

## Recommendation
<One line: ready to ship | block on the bugs in section X | re-run after fixes>
```

### 5. Update state and finish

Mark `- [x] 5. Triage — docs/test-report.md` in `docs/test-state.md`. Bump
"Last updated". Tell the user the report is ready, give them the counts and
the bottom-line recommendation, and point at the HTML report for visual
detail.

## Principles

- **Three buckets, no in-between.** Every failure is a real bug, a flaky
  test, or a wrong test. Forcing the classification is what makes the report
  actionable.
- **State confidence honestly.** "Likely a real bug, low confidence — could
  also be a stale selector" is more useful than a wrong-but-confident verdict.
- **One root cause, one finding.** Twelve failures from one auth bug is one
  finding. Counting them as twelve misleads the user about priority.
- **Recommend an action, not just a diagnosis.** A finding without a next
  step is a complaint, not a triage.
- **Wrong tests are not bugs.** Counting a broken spec as a product defect
  burns the developer's trust in the suite. Be honest.
