---
name: test-write
description: >-
  Generates the Playwright test specs, configuration, authentication setup, and
  environment template for a testing job, then pauses so the user can review the
  specs before they ever run. Use this skill after the test plan exists, or
  whenever the user wants to "write the tests", "scrie testele", "generate
  Playwright specs", "code the tests", "build the test suite", or describes
  wanting concrete test files for a target. It reads docs/test-plan.md and
  produces tests/, playwright.config.ts, tests/global-setup.ts, .env.example,
  and updates .gitignore. It will not run the tests — that is the next phase.
---

# Write Tests

This skill turns the plan into runnable Playwright specs. It writes the config,
the auth setup, an env template, and one spec file per area of the plan — then
**stops and shows the specs to the user for review** before the pipeline moves
on. That pause is deliberate: catching a bad selector or a missing assertion
before the suite runs saves time the next two phases would otherwise burn.

## When to use this

Run this after `test-plan` has produced `docs/test-plan.md`. It can also run on
its own when a plan already exists — for example, if the user wants to regenerate
the specs after editing the plan.

## Inputs and outputs

- **Reads:** `docs/test-plan.md` (the source of truth for scope, target,
  critical paths, auth), `docs/test-state.md` (mode: embedded vs standalone),
  and — in embedded mode — the project's source so element selectors match
  what is rendered.
- **Writes:**
  - `playwright.config.ts`
  - `tests/<area>.spec.ts` — one per critical path or area
  - `tests/global-setup.ts` (only if the plan has auth)
  - `.env.example` (only if the plan has auth or other secrets)
  - `.gitignore` additions (`.env`, `node_modules/`, `test-results/`,
    `playwright-report/`, `tests/storageState.json`)
  - `package.json` if missing (minimal, just so npm can install Playwright)
- **Updates:** `docs/test-state.md` (marks Write done after the user approves).

## Workflow

### 1. Read the plan

Read `docs/test-plan.md` and `docs/test-state.md` in full. Extract:

- Target URL and mode (embedded vs standalone).
- Start command (embedded only).
- Scope checkboxes (smoke / E2E / regression / API / a11y / visual).
- Critical user paths — each becomes a test in the E2E spec.
- Authentication — whether to write `global-setup.ts` and `.env.example`.
- Browsers and viewports — for `playwright.config.ts` projects.

If anything important is missing or ambiguous, **go back to `test-plan`** rather
than guess. Bad inputs make bad specs.

### 2. Ensure Playwright can install

Confirm Node is present (`node --version`). If it is missing, stop and ask the
user to install Node from nodejs.org — `npm` is the very tool that installs
Playwright, so this skill cannot install Node for itself.

If there is no `package.json` (typical in standalone mode), create a minimal
one:

```json
{
  "name": "<project-folder-name>-tests",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:report": "playwright show-report"
  }
}
```

Do **not** run `npm install` yet — that happens in `test-run`. This phase is
write-only on purpose, so the user can review before anything executes.

### 3. Write playwright.config.ts

Build the config from the plan. Template:

```ts
import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";
dotenv.config();

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "<URL from the plan>",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // channel: "chromium",  // uncomment if the bundled browser fails to launch
  },
  // globalSetup: "./tests/global-setup.ts",   // include only if the plan has auth
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    // add firefox / webkit / Mobile Safari per the plan
  ],
  // webServer: {                              // embedded mode only
  //   command: "<start command from the plan>",
  //   url: "<baseURL>",
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
});
```

Resolve the conditionals before writing — leave only the lines that apply to
this project. The commented `channel: "chromium"` line is left as a comment
even when not needed, because the `test-run` skill toggles it on if the
browser fails to launch in sandboxed Linux.

### 4. Write tests/global-setup.ts (auth only)

If the plan has auth, write a global-setup that logs in once and saves the
storage state. Template:

```ts
import { chromium, FullConfig } from "@playwright/test";

export default async function globalSetup(_: FullConfig) {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Missing TEST_USER_EMAIL / TEST_USER_PASSWORD in .env — copy .env.example to .env and fill them in."
    );
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(process.env.BASE_URL + "<login path from the plan>");

  // Use accessible-name selectors, not CSS.
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/parol|password/i).fill(password);
  await page.getByRole("button", { name: /login|conect|intr/i }).click();

  // Assert login succeeded — never save a half-logged-in state.
  await page.waitForURL((url) => !/login/i.test(url.pathname));

  await page.context().storageState({ path: "tests/storageState.json" });
  await browser.close();
}
```

In the projects' `use` block in `playwright.config.ts`, add
`storageState: "tests/storageState.json"` so specs start logged in.

### 5. Write .env.example

```
# Copy to .env and fill in. The .env file is gitignored.
BASE_URL=<URL from the plan>
TEST_USER_EMAIL=
TEST_USER_PASSWORD=
```

Add any other secrets the plan mentioned (additional accounts, API keys).
**Never** put a real value here.

### 6. Update .gitignore

Append (creating the file if missing):

```
node_modules/
test-results/
playwright-report/
.env
tests/storageState.json
```

### 7. Write the spec files

One file per area, named after the area: `tests/home.spec.ts`,
`tests/contact-form.spec.ts`, `tests/login.spec.ts`, `tests/checkout.spec.ts`,
etc. For each critical path in the plan, write one `test(...)` block.

Apply these rules — they are why specs survive a refactor:

- **Find elements like a user.** Use `getByRole`, `getByLabel`, `getByText`,
  `getByPlaceholder` — not raw CSS selectors. This also doubles as a partial
  accessibility check.
- **Assert observable outcomes.** The success message appears, the URL changes,
  the new item is visible, the error text shows on bad input. Never just
  assert "the button exists".
- **No arbitrary `waitForTimeout`.** Use web-first assertions
  (`await expect(locator).toBeVisible()`) — Playwright waits for the condition.
- **Cover the unhappy path.** For every form: empty submit, invalid input,
  expected error. For auth: wrong password.
- **One scenario per `test()`.** A test that covers three things and fails
  tells you nothing.

For each scope category checked in the plan, add the matching specs:

- **Smoke** — `tests/smoke.spec.ts`: each main page loads, no console errors,
  hero/main heading visible, no 404s on key links.
- **E2E** — `tests/<journey>.spec.ts`: one per critical path. The happy path
  plus at least one unhappy path.
- **Regression** — handled by the same E2E + smoke specs; nothing extra
  written, but the plan records the intent.
- **API** — `tests/api.spec.ts`: use Playwright's `request` fixture. Assert
  status code, schema (shape), and auth behavior.
- **Accessibility** — `tests/a11y.spec.ts`: use `@axe-core/playwright` to scan
  the key pages and assert zero violations for the levels the user asked for
  (typically WCAG 2.1 AA).
- **Visual** — `tests/visual.spec.ts`: `await expect(page).toHaveScreenshot()`
  on key pages. The first run creates baselines; tell the user they must
  review and commit those baselines before the second run.

For each spec file, add a one-line comment at the top tying it back to the
plan: `// Covers: <name from the plan>` — that is the only comment a spec
should need.

### 8. Console-error guard for smoke

In smoke and key-page tests, attach a console listener that fails the test on
unexpected console errors. Pattern:

```ts
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  test.info().annotations.push({ type: "console-errors", description: () => errors.join("\n") });
});
```

(Adjust per the user's tolerance — some apps log expected non-fatal errors.)

### 9. Pause for user review

This is the most important part of the skill. After writing every file, **stop
and show the user**:

- The list of files written, with one-line summaries.
- The full contents of the spec files (they are short — show them inline).
- The `playwright.config.ts`.
- A reminder to copy `.env.example` to `.env` and fill in the credentials, if
  auth was wired.

Then ask explicitly: *"Vrei să mai schimbi ceva înainte de verify + run, sau
mergem mai departe?"* — and wait. Do not advance the pipeline on your own.

Apply any requested changes, re-show, and wait again.

### 10. Update state

Once the user approves the specs, mark Write done in `docs/test-state.md` and
hand off to `test-verify`.

## Principles

- **The review pause is the point of this skill.** Skipping it defeats the
  toolkit's safety net — verify catches structural issues, but only the user
  can confirm a spec tests what the business actually cares about.
- **Find elements like a user.** Roles, labels, and visible text make tests
  robust *and* exercise accessibility for free.
- **Real assertions only.** Existence checks tell you nothing — the user can't
  see "exists", they see content, URLs, and messages.
- **No real secrets in repo files.** `.env.example` is a template; `.env` is
  gitignored. The plan and the specs name *what* logs in, not *how*.
- **Write, do not run.** Running is the next phase. Keeping write and run
  separate is what lets the user review safely.
