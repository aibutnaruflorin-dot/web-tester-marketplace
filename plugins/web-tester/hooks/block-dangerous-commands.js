#!/usr/bin/env node
/**
 * web-tester safety hook — PreToolUse / Bash
 *
 * Inspects every shell command before it runs and blocks the small set of
 * commands that are catastrophic and effectively never intentional: wiping the
 * root or home directory, formatting disks, fork bombs, piping remote scripts
 * straight into a shell, and force-pushing over remote history.
 *
 * It is a safety net, not a sandbox. It deliberately blocks only high-confidence,
 * low-false-positive patterns so it almost never gets in the way of real work.
 *
 * Exit 0 = allow. Exit 2 = block (the reason on stderr is shown to Claude).
 */

const fs = require("fs");

function main() {
  let raw = "";
  try {
    raw = fs.readFileSync(0, "utf8");
  } catch {
    process.exit(0); // no input — nothing to check
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    process.exit(0); // unparseable input — fail open, do not block real work
  }

  const command = data && data.tool_input && data.tool_input.command;
  if (!command || typeof command !== "string") process.exit(0);

  const checks = [
    {
      re: /\brm\b\s+(?:-\S+\s+|--\S+\s+)*['"]?(?:\/|~|\$HOME)['"]?(?:\/?\*)?(?:\s|;|$)/,
      reason:
        'This deletes "/", "~", or $HOME — it would wipe the entire system or your whole home directory.',
    },
    {
      re: /--no-preserve-root/,
      reason:
        '"--no-preserve-root" disables the guard that stops rm from deleting the root filesystem.',
    },
    {
      re: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
      reason:
        "This is a fork bomb — it spawns processes endlessly and freezes the machine.",
    },
    {
      re: /\bmkfs(\.\w+)?\b/,
      reason:
        "mkfs formats a filesystem — on the wrong device it destroys all data on the drive.",
    },
    {
      re: /\bdd\b[^\n]*\bof=\/dev\/(?:sd|nvme|hd|disk|mmcblk)/,
      reason:
        "dd writing directly to a disk device overwrites the drive and destroys its contents.",
    },
    {
      re: />\s*\/dev\/(?:sd|nvme|hd|disk|mmcblk)/,
      reason: "Redirecting output onto a raw disk device corrupts the drive.",
    },
    {
      re: /\bchmod\s+(?:-R\s+|--recursive\s+)?0?777\s+['"]?(?:\/|~|\$HOME)['"]?(?:\s|;|$)/,
      reason:
        'chmod 777 on "/", "~", or $HOME strips all permission protection from the whole tree.',
    },
    {
      re: /\b(?:curl|wget)\b[^\n]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh|ksh)\b/,
      reason:
        "Piping a downloaded script straight into a shell runs unverified remote code. Download it, read it, then run it.",
    },
  ];

  for (const c of checks) {
    if (c.re.test(command)) block(c.reason, command);
  }

  // Force-push: allowed only as the safer --force-with-lease.
  if (
    /\bgit\s+push\b/.test(command) &&
    /(?:--force(?!-with-lease)|\s-f(?:\s|$))/.test(command)
  ) {
    block(
      'git push --force can permanently overwrite remote history. If this is intentional, use "--force-with-lease" instead — it refuses to clobber commits you have not seen.',
      command
    );
  }

  process.exit(0); // nothing matched — allow
}

function block(reason, command) {
  process.stderr.write(
    "BLOCKED by the web-tester safety hook.\n\n" +
      "Reason: " +
      reason +
      "\n\nCommand: " +
      command +
      "\n\nIf you are certain this is safe and intended, ask the user to run it " +
      "themselves in their own terminal.\n"
  );
  process.exit(2);
}

main();
