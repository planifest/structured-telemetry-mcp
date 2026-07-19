#!/usr/bin/env node
/**
 * GitHub Copilot hooks adapter — delegating (ADR-003, REQ-015).
 *
 * Translates the Copilot hook envelope to the Planifest common envelope and
 * delegates enforcement to gate-write.mjs (preToolUse) or check-design.mjs
 * (userPromptSubmitted). Never contains inline enforcement logic.
 *
 * Block mechanism: JSON { "permissionDecision": "deny", "permissionDecisionReason": "..." }
 * on stdout + exit 0. Exit code 2 is a warning-only in Copilot (ADR-001).
 *
 * Accepted envelope formats (both detected by event name):
 *   camelCase:  { sessionId, timestamp, cwd, toolName, toolArgs }
 *   PascalCase: { hook_event_name, session_id, timestamp, cwd, tool_name, tool_input }
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const enfDir = join(__dir, "..", "enforcement");

function readStdin() {
  return new Promise((res) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (c) => { data += c; });
    process.stdin.on("end", () => res(data.replace(/^﻿/, "")));
    process.stdin.resume();
  });
}

function deny(reason) {
  process.stdout.write(JSON.stringify({
    permissionDecision: "deny",
    permissionDecisionReason: reason,
  }));
  process.exit(0);
}

try {
  const raw = await readStdin();

  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); }

  // Normalise event name and fields from either envelope format
  const rawEvent = (
    input?.hook_event_name ?? input?.hookEventName ??
    input?.event ?? ""
  ).toLowerCase();

  const cwd = input?.cwd ?? process.cwd();
  const sessionId = input?.session_id ?? input?.sessionId ?? "";
  const toolName = input?.tool_name ?? input?.toolName ?? "";
  const toolInput = input?.tool_input ?? input?.toolArgs ?? {};

  // Build the common Planifest envelope
  const envelope = JSON.stringify({
    session_id: sessionId,
    cwd,
    tool_input: { path: toolInput?.path ?? toolInput?.file_path ?? "", ...toolInput },
    event: rawEvent.includes("prompt") ? "UserPromptSubmit" : "PreToolUse",
  });

  // --- preToolUse / pre_tool_use: gate-write ---
  if (rawEvent === "pretooluse" || rawEvent === "pre_tool_use") {
    const result = spawnSync(
      process.execPath,
      [join(enfDir, "gate-write.mjs")],
      { input: envelope, encoding: "utf-8" }
    );

    if (result.status === 2) {
      const reason = (result.stdout ?? "").trim() || "Write blocked by Planifest scope enforcement.";
      deny(reason);
    }
    // allow or unexpected error — exit 0 (fail-open per NFR-003)
    process.exit(0);
  }

  // --- userPromptSubmitted / prompt_submit: check-design context injection ---
  if (rawEvent === "userpromptsubmitted" || rawEvent === "prompt_submit") {
    const result = spawnSync(
      process.execPath,
      [join(enfDir, "check-design.mjs")],
      { input: envelope, encoding: "utf-8" }
    );

    const context = (result.stdout ?? "").trim();
    if (context) {
      process.stdout.write(JSON.stringify({ additionalContext: context }));
    }
    process.exit(0);
  }

  // Unknown event — pass through silently
  process.exit(0);
} catch {
  // Never block on unexpected errors (NFR-003)
  process.exit(0);
}
