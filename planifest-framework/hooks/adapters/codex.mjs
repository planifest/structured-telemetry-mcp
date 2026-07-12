#!/usr/bin/env node
/**
 * Codex CLI hook adapter — Tier 1b (ADR-001, ADR-002, REQ-019).
 *
 * Reads the Codex hook envelope from stdin, dispatches on hook_event_name,
 * and delegates to gate-write.mjs or check-design.mjs via spawnSync.
 * Never contains inline enforcement logic.
 *
 * NOTE: Codex CLI hooks are Bash-only. Write interception works on macOS/Linux.
 * Windows is not supported (REQ-010). This adapter exits 0 silently on Windows.
 *
 * Codex hook envelope shape:
 *   { hook_event_name, session_id, cwd, tool_name, tool_input }
 *
 * Block mechanism: JSON deny response on stdout + exit 0 (Codex pre-hooks).
 * Deny format: { "hookSpecificOutput": { "hookEventName": "PreToolUse",
 *                 "permissionDecision": "deny", "permissionDecisionReason": "..." } }
 *
 * Requires: features.codex_hooks = true in .codex/config.toml
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { platform } from "node:os";

const __dir = dirname(fileURLToPath(import.meta.url));
const enfDir = join(__dir, "..", "enforcement");

async function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (c) => { data += c; });
    process.stdin.on("end", () => resolve(data.replace(/^﻿/, "")));
    process.stdin.resume();
  });
}

try {
  // Windows: Codex hooks are Bash-only (REQ-010)
  if (platform() === "win32") process.exit(0);

  const raw = await readStdin();

  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); }

  const eventName = (input?.hook_event_name ?? "").toLowerCase();
  const sessionId = input?.session_id ?? "";
  const cwd = input?.cwd ?? process.cwd();

  // --- PreToolUse: gate-write ---
  if (eventName === "pretooluse") {
    const toolName = input?.tool_name ?? "";
    const toolInput = input?.tool_input ?? {};

    const envelope = JSON.stringify({
      session_id: sessionId,
      cwd,
      tool_input: { path: toolInput?.path ?? toolInput?.file_path ?? "", tool_name: toolName },
      event: "PreToolUse",
    });

    const result = spawnSync(
      process.execPath,
      [join(enfDir, "gate-write.mjs")],
      { input: envelope, encoding: "utf-8" }
    );

    if (result.status === 2) {
      // Extract reason from gate-write stdout, or use a default
      const reason = (result.stdout ?? "").trim() || "Planifest: write blocked — no confirmed design for this path.";
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: reason,
        },
      }) + "\n");
    }

    // Codex deny is via JSON on stdout; always exit 0
    process.exit(0);
  }

  // --- UserPromptSubmit: check-design scope injection ---
  if (eventName === "userpromptsubmit" || eventName === "userpromptsubmitted") {
    const envelope = JSON.stringify({
      session_id: sessionId,
      cwd,
      tool_input: {},
      event: "UserPromptSubmit",
    });

    const result = spawnSync(
      process.execPath,
      [join(enfDir, "check-design.mjs")],
      { input: envelope, encoding: "utf-8" }
    );

    if (result.stdout) process.stdout.write(result.stdout);
    process.exit(0);
  }

  // Unknown event — pass through silently
  process.exit(0);
} catch {
  // Never block on unexpected errors (NFR-003)
  process.exit(0);
}
