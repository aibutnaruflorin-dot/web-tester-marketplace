#!/usr/bin/env node
/**
 * web-tester auto-format hook — PostToolUse / Edit|Write|MultiEdit
 *
 * After Claude edits or creates a file, this runs Prettier on that file so the
 * codebase stays consistently formatted without anyone thinking about it.
 *
 * It is intentionally opt-in and safe:
 *  - It only acts if the project already has Prettier installed locally
 *    (node_modules/.bin/prettier). A project that does not use Prettier is
 *    left completely untouched.
 *  - It only touches files Prettier understands.
 *  - It never fails the operation — any error is swallowed and it exits 0.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const SUPPORTED = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  ".css", ".scss", ".less",
  ".html", ".json", ".md", ".mdx",
  ".yaml", ".yml", ".vue", ".svelte",
]);

function main() {
  let raw = "";
  try {
    raw = fs.readFileSync(0, "utf8");
  } catch {
    process.exit(0);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const filePath = data && data.tool_input && data.tool_input.file_path;
  if (!filePath || typeof filePath !== "string") process.exit(0);

  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED.has(ext)) process.exit(0);

  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) process.exit(0);

  // Walk up from the file to find a locally installed Prettier.
  const binName = process.platform === "win32" ? "prettier.cmd" : "prettier";
  let dir = path.dirname(abs);
  let prettier = null;
  while (true) {
    const candidate = path.join(dir, "node_modules", ".bin", binName);
    if (fs.existsSync(candidate)) {
      prettier = candidate;
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  // No local Prettier — this project does not use it, so do nothing.
  if (!prettier) process.exit(0);

  try {
    execFileSync(prettier, ["--write", abs], { stdio: "ignore" });
  } catch {
    // Formatting failed (syntax error, config issue) — never block on it.
  }

  process.exit(0);
}

main();
