# CLAUDE.md — working on the web-tester toolkit

This repository **is** the `web-tester` plugin and its marketplace. It is not a
website itself — it is the set of skills and hooks that test websites. Read this
file when the task is to maintain, fix, or extend the toolkit.

## What this repo is

A Claude Code marketplace (`web-testing-tools`) containing one plugin
(`web-tester`). The plugin provides six skills and two hooks that, together,
take a page or web app from "I want to test this" to a triaged test report —
with a human review checkpoint on the specs before anything is executed.

## Structure

- `.claude-plugin/marketplace.json` — the marketplace catalog.
- `plugins/web-tester/.claude-plugin/plugin.json` — the plugin manifest.
- `plugins/web-tester/skills/<name>/SKILL.md` — one folder per skill.
- `plugins/web-tester/hooks/` — `hooks.json` plus the two Node hook scripts.

## The pipeline the skills implement

`test-project` is the orchestrator. It runs five phase skills in order:
`test-plan` → `test-write` → `test-verify` → `test-run` → `defect-review`.

## The shared convention every skill depends on

The phase skills coordinate through files in the project's `docs/` folder —
this is the contract that lets them work as a pipeline:

- `docs/test-plan.md` — written by `test-plan`.
- `docs/test-review.md` — written by `test-verify`.
- `docs/test-report.md` — written by `defect-review`.
- `docs/test-state.md` — the progress tracker; **every** skill reads it and
  updates its line.

Test code lives in `tests/` and `playwright.config.ts` at the project root.

If you change this convention, change it in **all** skills at once — they are
only a pipeline because they agree on these file names and the `test-state.md`
format. The format currently has five numbered pipeline items.

## The two project modes

The toolkit auto-detects which mode it is running in:

- **Embedded** — the project folder already contains application code
  (a `package.json`, a `src/`, a Next.js or Vite app, etc.). Tests live in a
  `tests/` folder next to the code; `playwright.config.ts` starts the local
  dev server via its `webServer` block.
- **Standalone** — the project folder is empty or only contains test artifacts.
  The toolkit scaffolds a tests-only project that hits a remote URL given by the
  user; no `webServer` block.

`test-plan` detects this and records the mode in `docs/test-state.md`. Later
skills branch on it.

## How to edit a skill

Each skill is a single `SKILL.md` with YAML frontmatter (`name`, `description`)
and a Markdown body. Keep these qualities, because they are why the skills work:

- The `description` is the trigger. It must say *what* the skill does and *when*
  to use it, with the real phrases a user would type — in Romanian **and**
  English, because the primary user works in both. Keep it a little "pushy" so
  the skill is not under-triggered.
- The body uses imperative instructions and explains the *why* behind them.
- Keep each `SKILL.md` well under 500 lines.

## How to add a new phase skill

1. Create `plugins/web-tester/skills/<new-name>/SKILL.md`.
2. State its inputs (which `docs/` files it reads) and outputs (which it writes),
   following the shared convention above.
3. Add it to the pipeline in `test-project/SKILL.md` — the pipeline diagram, the
   `test-state.md` template, and the numbered "run the phases" list.
4. Add the matching line to the `test-state.md` template in `test-plan/SKILL.md`.
5. Bump `version` in `plugin.json` and `marketplace.json`.

## The hooks

`hooks/hooks.json` registers two hooks (auto-loaded by Claude Code v2.1+):

- `block-dangerous-commands.js` — PreToolUse/Bash. Blocks a small, high-confidence
  set of catastrophic commands. When adding a pattern, favour precision — a hook
  with false positives gets in the way and erodes trust.
- `auto-format.js` — PostToolUse/Edit|Write|MultiEdit. Runs Prettier, but only if
  the target project has it installed locally. Never let this hook fail an
  operation.

Both are plain Node scripts with no dependencies. Test a hook by piping a JSON
event into it: `echo '{"tool_input":{"command":"..."}}' | node hooks/<file>.js`.

## Releasing an update

Edit, then bump `version` in both `plugin.json` and `marketplace.json`, commit,
and push. Users pull the update with `/plugin marketplace update`.
