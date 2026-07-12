#!/usr/bin/env node
/**
 * UserPromptSubmit hook: auto-trigger the planifest-orchestrator skill.
 *
 * Fires on every user prompt. Performs two fast file-existence checks:
 *   1. planifest-framework/ exists → this is a planifest project
 *   2. plan/.orchestrator-active does NOT exist → orchestrator not yet loaded
 *
 * If both conditions are met, outputs an instruction to the model to load
 * the planifest-orchestrator skill. The instruction appears inline in the
 * model's context before it processes the user prompt.
 *
 * If either condition fails, exits 0 silently (no output, no effect).
 *
 * Design: ADR-003 — auto-trigger via UserPromptSubmit + CLAUDE.md fallback.
 * REQ-002.
 *
 * Exit codes: 0 = pass (no action or instruction emitted)
 * Never exits 2 — this hook does not block user prompts.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

function readStdin() {
  return new Promise((res) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (c) => { data += c; });
    process.stdin.on("end", () => res(data.replace(/^﻿/, "")));
    process.stdin.resume();
  });
}

try {
  const raw = await readStdin();
  const input = JSON.parse(raw);
  const cwd = input?.cwd ?? process.cwd();

  // Check 1 — is this a planifest project?
  const frameworkPath = join(cwd, "planifest-framework");
  if (!existsSync(frameworkPath)) process.exit(0);

  // Check 2 — is the orchestrator already active?
  const sentinelPath = join(cwd, "plan", ".orchestrator-active");
  if (existsSync(sentinelPath)) process.exit(0);

  // Both conditions met: emit the instruction to load the orchestrator.
  // Claude Code injects this output into the model's context before the prompt.
  process.stdout.write(
    "SYSTEM INSTRUCTION: This is a Planifest project (planifest-framework/ detected) " +
    "and the orchestrator has not been loaded yet for this session. " +
    "Load the planifest-orchestrator skill now, before responding to the user's prompt. " +
    "Begin with resume detection as described in the skill.\n"
  );

  process.exit(0);
} catch {
  // Never interfere with the session on unexpected errors.
  process.exit(0);
}
