---
name: test-project
description: >-
  Orchestrates a complete automated testing pass on a website or web app, end to
  end. Use this skill whenever the user wants to "test a site", "test this page",
  "QA this app", "write and run tests", "set up Playwright tests",
  "testează pagina", "testează aplicația", "vreau teste", "scrie și rulează
  testele", or describes wanting any web target tested — even if they do not name
  the individual phases. It runs the full pipeline in order — plan, write specs,
  verify specs, run, defect triage — by invoking one phase skill at a time, and
  it can resume a half-finished test run. Start here for any new testing job.
---

# Test Project — Pipeline Orchestrator

This skill takes a testing job from "I want to test this" to a triaged test
report by running five phases in sequence. It does not do the work of each phase
itself — it coordinates: figures out where the run stands, invokes the right
phase skill next, checkpoints with the user where their input matters, and
keeps the shared state file accurate.

## The pipeline

```
1. Plan    →  test-plan       →  docs/test-plan.md      (URL, scope, accounts, critical paths)
2. Write   →  test-write      →  tests/ + config        (Playwright specs — PAUSE for review)
3. Verify  →  test-verify     →  docs/test-review.md    (quality audit on the written specs)
4. Run     →  test-run        →  test-results/          (npx playwright test + HTML report)
5. Triage  →  defect-review   →  docs/test-report.md    (real bugs vs flaky vs wrong tests)
```

Each phase is its own skill. This orchestrator invokes them by name, in order,
using the Skill tool. The five skills also work standalone — a user can run just
one — but for a full testing pass, this skill drives them.

## Shared conventions

Every testing job lives in one project folder. Cross-phase artifacts live in
`docs/`:

- `docs/test-plan.md` — what gets tested and how
- `docs/test-review.md` — quality audit on the written specs
- `docs/test-report.md` — final triaged report
- `docs/test-state.md` — the progress tracker every phase reads and updates

Test code lives in `tests/` and `playwright.config.ts` at the project root.

The tracker is the source of truth for "where are we". Its format:

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

## Workflow

### 1. Determine where the run stands

Check the project folder for `docs/test-state.md`.

- **No state file** — this is a new testing job. Start at phase 1.
- **State file exists** — this is a resume. Read it, show the user the
  checklist, and continue from the first unchecked phase. Confirm before
  proceeding.

### 2. Confirm the plan with the user

Tell the user the pipeline you will run and roughly what each phase involves.
Ask two things up front, because they change the path:

- **Scope** — the full pipeline, or only some phases? (Some users already have
  specs written and only want to run + triage; others only want a plan.)
- **Checkpoints** — pause for review after every phase, or just at the two that
  matter most (plan and written specs)? The default is the latter.

### 3. Run the phases in order

For each phase that is not yet done, invoke its skill with the Skill tool and
let that skill do its work:

1. `test-plan` — interviews the user, detects embedded vs standalone mode,
   writes `docs/test-plan.md` and `docs/test-state.md`.
2. `test-write` — generates `playwright.config.ts`, `tests/`, `global-setup.ts`,
   `.env.example`, and the spec files. **This phase pauses for user review** of
   the written specs before the pipeline continues — do not skip the pause.
3. `test-verify` — audits the written specs for fragile selectors, real
   assertions, no arbitrary sleeps, unhappy-path coverage, and leaked secrets.
   Writes `docs/test-review.md`. Auto-fixes minor issues; flags major ones for
   the user.
4. `test-run` — installs Playwright if missing, runs `npx playwright test`,
   captures the HTML report. Reports raw pass/fail counts only.
5. `defect-review` — triages each failure into real bug / flaky / wrong test,
   writes `docs/test-report.md`.

After each phase: verify the phase skill marked itself done in
`docs/test-state.md`, then — if the user asked for checkpoints — show them what
that phase produced and wait for a go-ahead before the next phase.

**Two checkpoints are always non-negotiable**, even with "no checkpoints"
selected:

- After `test-plan` — the user must confirm scope and critical paths before
  any specs get written. Getting the plan wrong wastes the whole pipeline.
- After `test-write` — the user must see the specs before they ever run.
  This is the explicit human-review step the toolkit is built around.

### 4. Handle problems

If a phase cannot complete (Node not installed, browsers fail to launch, the
target URL is unreachable, the dev server will not start), stop the pipeline,
explain the blocker plainly, and help the user resolve it before continuing.
Do not skip ahead past a broken phase — later phases depend on earlier ones.
Record the blocker in the state file's Notes so a later resume has the context.

### 5. Optional: use a subagent for the run phase

The orchestrator may delegate `test-run` to a subagent to keep the main context
clean — Playwright output is verbose. This is an optimization, not a
requirement. Keep phases that need user interaction (the plan interview, the
spec review) in the main conversation.

### 6. Finish

When the pipeline is complete, give the user a short closing summary: how many
tests passed and failed, how many real bugs were found, where the HTML report
is, and how to re-run the suite locally.

## Principles

- **One phase at a time, in order.** Each phase depends on the artifacts of the
  one before it. The plan drives the specs; the specs drive the run; the run
  drives the triage.
- **The state file is the source of truth.** Always read it to decide what is
  next; always confirm each phase updated it. This is what makes a run
  resumable across sessions and machines.
- **Checkpoint where the human matters.** The plan and the written specs are
  cheap to fix before they run and expensive to fix after. Spend the user's
  review attention there.
- **Stop on a real blocker.** A broken phase does not get skipped — it gets
  fixed. Running tests on top of a broken setup only multiplies the problem.
- **Verify before run.** The `test-verify` phase exists because a green run of
  bad tests is worse than a red run of good ones. Never skip it.
