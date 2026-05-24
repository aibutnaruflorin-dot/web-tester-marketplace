# web-tester

A Claude Code plugin that turns testing a website into a guided, repeatable
pipeline. You point Claude at a page or app; it interviews you, writes
Playwright specs, shows them to you for review, audits them for quality, runs
them, triages the failures, and writes a clear report.

It is built as **six coordinated skills** plus **two safety hooks**, packaged so
you install it once and use it in every project, on any computer.

## What's inside

**The orchestrator**

- `test-project` — runs the whole pipeline end to end and can resume a
  half-finished test run.

**The five phase skills** (each also works on its own)

| Skill | Phase | What it does |
|-------|-------|--------------|
| `test-plan` | Plan | Interviews you for URL, scope, critical paths, accounts; writes the test plan |
| `test-write` | Write | Generates Playwright specs + config + auth setup, then pauses for your review |
| `test-verify` | Verify | Audits the written specs against a quality checklist before they ever run |
| `test-run` | Run | Installs Playwright if needed and runs the suite, captures HTML report and artifacts |
| `defect-review` | Triage | Separates real bugs from flaky or wrong tests, writes the final test report |

**Two safety hooks**

- `block-dangerous-commands` — blocks catastrophic shell commands before they run
  (wiping `/` or `~`, formatting disks, fork bombs, `curl | bash`, `git push --force`).
- `auto-format` — runs Prettier on files Claude edits, but only in projects that
  already have Prettier installed, so it never surprises you.

## Install in VS Code (Claude Code)

You need the Claude Code extension in VS Code. Installation is two commands, typed
into Claude Code.

**1. Add the marketplace.**

```
/plugin marketplace add aibutnaruflorin-dot/web-tester-marketplace
```

**2. Install the plugin.**

```
/plugin install web-tester@web-testing-tools
```

That's it. The six skills and the hooks are now available in **every** project
you open in VS Code on this computer. Repeat the two commands on any other
computer to have them there too.

## How to use it

Open any project folder — or just an empty folder, if you only want to test a
remote URL — and say what you want:

> "Vreau să testez https://exemplu.ro — vreau smoke + E2E pe fluxul de contact."

The `test-project` orchestrator picks it up, interviews you, and walks through
the pipeline — pausing for your approval after the test plan and after the
specs are written, where your input matters most.

You can also run a single phase. "Scrie testele Playwright pentru pagina asta"
triggers `test-write` on its own; "rulează testele" triggers `test-run`;
"triază defectele" triggers `defect-review`.

## What the pipeline produces

In your project's `docs/` folder:

- `docs/test-plan.md` — what gets tested, why, and how
- `docs/test-state.md` — progress tracker, shared by every skill
- `docs/test-review.md` — quality audit of the specs before they run
- `docs/test-report.md` — final report: pass/fail, real bugs, flaky tests, recommendations

And at the project root:

- `tests/` — the Playwright specs
- `playwright.config.ts` — config (browsers, baseURL, webServer, retries)
- `tests/global-setup.ts` + `tests/storageState.json` — login captured once, reused everywhere
- `.env.example` — template for the test credentials (real `.env` stays gitignored)

## Updating the plugin

This repo is published at
https://github.com/aibutnaruflorin-dot/web-tester-marketplace — that is what
makes it portable: run the two install commands above on any computer.

To ship an update: clone the repo, edit a skill, bump the `version` in
`plugin.json` and `marketplace.json`, commit, and push. Users pull the update
with `/plugin marketplace update`.

## Repository layout

```
web-tester-marketplace/
├── README.md                       you are here
├── CLAUDE.md                       guide for working on the toolkit itself
├── .claude-plugin/
│   └── marketplace.json            the marketplace catalog
└── plugins/
    └── web-tester/
        ├── .claude-plugin/
        │   └── plugin.json         the plugin manifest
        ├── skills/                 the 6 skills
        └── hooks/                  the 2 safety hooks + hooks.json
```

## License

Add a license of your choice (MIT is a common default) before publishing publicly.
