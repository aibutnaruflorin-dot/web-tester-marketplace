---
name: test-run
description: >-
  Installs Playwright if needed and runs the test suite, captures the HTML
  report and artifacts (traces, screenshots, videos), and reports the raw
  pass/fail counts. Use this skill after the specs have been verified, or
  whenever the user wants to "run the tests", "rulează testele", "execute the
  suite", "run Playwright", or just "run it". It does NOT triage failures —
  that is the next phase (defect-review). It reads playwright.config.ts and
  tests/, runs `npx playwright test`, writes raw results under test-results/
  and playwright-report/, and updates docs/test-state.md.
---

# Run Tests

This skill executes the suite that `test-write` produced and `test-verify`
audited. It is intentionally narrow: install if needed, run, capture, report
counts. Deciding what each failure *means* is the job of the next skill,
`defect-review` — keeping them separate keeps each one short and replaceable.

## When to use this

Run this after `test-verify`. It can also run standalone whenever the user
wants to re-execute an existing suite — for example, after fixing a bug found
in the previous run.

## Inputs and outputs

- **Reads:** `tests/`, `playwright.config.ts`, `.env` (must exist if the plan
  has auth), `docs/test-plan.md`, `docs/test-state.md`.
- **Writes:** `test-results/` (per-test artifacts), `playwright-report/` (HTML
  report), `tests/storageState.json` (if auth and global-setup runs).
- **Updates:** `docs/test-state.md` (marks Run done with the raw counts).

## Workflow

### 1. Pre-flight

Confirm Node is installed (`node --version`). If it is missing, stop and ask
the user to install Node from nodejs.org.

Check the auth precondition: if the plan declares auth, `.env` must exist at
the project root with `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` (and any
other accounts the plan named). If `.env` is missing, stop and tell the user
to copy `.env.example` to `.env` and fill it in — do not invent values.

Check the target precondition: in standalone mode, ping the target URL with a
quick `curl -sI` and confirm it returns anything other than connection
refused. If the target is unreachable, stop and surface the error — running
the suite against an unreachable target produces useless results.

### 2. Install Playwright if missing

If `node_modules/@playwright/test` does not exist, install:

```
npm install
npx playwright install --with-deps
```

On Windows, drop `--with-deps` — it is Linux-only. On macOS without sudo,
`--with-deps` may also fail; fall back to plain `npx playwright install`.

If the install completes but a later run fails with "Error loading V8 startup
snapshot file" or a similar bundled-browser crash, edit `playwright.config.ts`
to uncomment `channel: "chromium"` in the `use` block (the template left it
ready). That uses the system-installed Chromium build, which is more robust
in sandboxed Linux environments. Then rerun.

### 3. Run the suite

```
npx playwright test
```

For long suites, allow up to 10 minutes (use `timeout: 600000` on the Bash
call). If the user only wants a subset, accept Playwright's standard filters:

- `--project=chromium-desktop` — one browser project only
- `--grep "<pattern>"` — only tests matching the name
- `tests/<file>.spec.ts` — one file only

Use these only when the user asked for them — a normal run is the full suite.

### 4. Parse the result

Playwright prints a final summary line like
`3 passed, 1 failed, 0 skipped (12.3s)`. Extract:

- Total tests run
- Passed
- Failed
- Flaky (tests that passed on retry — Playwright marks them separately)
- Skipped

Also note: did `globalSetup` succeed? A failure there fails the whole run
before any spec executes — call that out distinctly.

### 5. Capture artifacts

After the run, two folders contain everything the triage phase needs:

- `playwright-report/` — the HTML report
  (`npx playwright show-report` opens it).
- `test-results/<test-id>/` — per-test traces, screenshots, videos, error
  snapshots.

Do not delete or move these. `defect-review` reads them.

### 6. Update state

In `docs/test-state.md`:

- Mark `- [x] 4. Run — test-results/`.
- Bump "Last updated".
- Append a one-line Notes entry: `Run <date>: <P> passed, <F> failed, <K>
  flaky` so a later resume can see the last result without opening the report.

### 7. Report back to the user

Keep this short — triage is the next phase, not this one. Tell the user:

- Pass/fail/flaky counts.
- Whether `globalSetup` succeeded.
- The path to `playwright-report/` and the command to open it
  (`npx playwright show-report`).
- That `defect-review` is next and will classify each failure.

### 8. Do not classify failures here

This is the rule that keeps the pipeline clean. Resist the urge to say "this
failure looks like a real bug" or "this looks flaky" in this phase. Report
counts only. The whole point of having `defect-review` as a separate skill is
that triage deserves its own focused pass.

The one exception: if **every** test failed and the failure mode is identical
across them (e.g., every test failed at `globalSetup`, or every test failed
with "net::ERR_CONNECTION_REFUSED"), say so plainly — that is a setup problem,
not test failures, and the user needs to fix it before triage is meaningful.

## Principles

- **Run, don't interpret.** Counts and artifacts only. Triage is the next
  skill and it deserves a clean slate.
- **Stop on a setup problem.** Missing `.env`, unreachable target, failed
  install — these are blockers, not test failures. Fix them before running.
- **Never retry a failure into a pass by accident.** Playwright's `retries`
  setting is for catching flakiness, not for masking real bugs. If a test
  passes on retry, it counts as flaky and triage will look at why.
- **Keep the artifacts.** Traces and videos are most of what makes Playwright
  worth using — never clean them up before triage.
