#!/usr/bin/env node
/**
 * Cursor hook adapter — Tier 1 (ADR-001, ADR-002, REQ-018).
 *
 * Translates Cursor's native hook envelope to the Planifest common envelope,
 * then delegates to the appropriate shared hook script.
 *
 * Cursor PreToolUse envelope shape (current):
 *   { toolName, toolInput, conversation_id?, workspace_roots?: string[] }
 * Legacy fields also supported:
 *   { sessionId, workspaceRoot }
 *
 * Usage: node cursor.mjs <script> [phase]
 *   e.g.  node cursor.mjs gate-write
 *         node cursor.mjs check-design
 *         node cursor.mjs emit-phase-start spec
 *
 * Exit codes are passed through from the delegate script.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const SCRIPT_NAME = process.argv[2]; // e.g. "gate-write" or "check-design"
const PHASE_ARG = process.argv[3];   // e.g. "spec" (for telemetry scripts only)

const ADAPTER_DIR = dirname(new URL(import.meta.url).pathname);
const HOOKS_DIR = dirname(ADAPTER_DIR);

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
  if (!SCRIPT_NAME) process.exit(0);

  const raw = await readStdin();
  const cursorInput = JSON.parse(raw);

  // Translate Cursor envelope → Planifest common envelope (ADR-002, REQ-018)
  // workspace_roots is an array in current Cursor API; fall back to legacy workspaceRoot/cwd
  const cwd =
    (Array.isArray(cursorInput.workspace_roots) ? cursorInput.workspace_roots[0] : null) ??
    cursorInput.workspaceRoot ??
    cursorInput.cwd ??
    process.cwd();

  // check-design is called from beforeSubmitPrompt, not PreToolUse
  const event = SCRIPT_NAME === "check-design" ? "UserPromptSubmit" : "PreToolUse";

  const envelope = {
    session_id: cursorInput.conversation_id ?? cursorInput.sessionId ?? cursorInput.session_id,
    cwd,
    tool_input: cursorInput.toolInput ?? cursorInput.tool_input ?? {},
    event,
  };

  // Locate the target script
  const scriptSubdir = SCRIPT_NAME.startsWith("emit-") ? "telemetry" : "enforcement";
  const scriptPath = join(HOOKS_DIR, scriptSubdir, `${SCRIPT_NAME}.mjs`);

  if (!existsSync(scriptPath)) {
    // Script not found — pass through silently (ADR-005)
    process.exit(0);
  }

  const args = PHASE_ARG ? [scriptPath, PHASE_ARG] : [scriptPath];
  const result = spawnSync(process.execPath, args, {
    input: JSON.stringify(envelope),
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Pass through stdout (for check-design additionalContext and gate-write messages)
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  // Pass through exit code — propagates exit 2 blocks to Cursor (ADR-001)
  process.exit(result.status ?? 0);
} catch {
  // Adapter errors must never block the session (ADR-005)
  process.exit(0);
}
