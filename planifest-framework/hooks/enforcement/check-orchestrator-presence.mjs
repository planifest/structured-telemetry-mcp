#!/usr/bin/env node
/**
 * UserPromptSubmit hook: per-prompt orchestrator presence check.
 *
 * Two modes controlled by plan/.orchestrator-strict:
 *
 * Advisory (default):
 *   Injects a one-line banner on every prompt when a pipeline is active.
 *   Exit 0 always — never blocks.
 *
 * Strict (plan/.orchestrator-strict exists):
 *   On first prompt of a session (or after session change), injects a hard-block
 *   banner that instructs the model to load the orchestrator skill and write the
 *   session_id to plan/.orchestrator-ack before processing anything else.
 *   Once plan/.orchestrator-ack contains the matching session_id, exits 0 silently.
 *
 * Design: REQ-008.
 * Exit codes: 0 always — this hook informs but never blocks via exit 2.
 */

import { existsSync, readFileSync } from "node:fs";
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

  // Only act when a pipeline is active.
  const sentinelPath = join(cwd, "plan", ".orchestrator-active");
  if (!existsSync(sentinelPath)) process.exit(0);

  let featureId = "unknown";
  try {
    const raw = readFileSync(sentinelPath, "utf-8").trim();
    // Sanitise to prevent prompt injection via crafted sentinel file content.
    featureId = raw.replace(/[^a-zA-Z0-9\-_.]/g, "").slice(0, 80) || "unknown";
  } catch { /* keep default */ }

  const strictPath = join(cwd, "plan", ".orchestrator-strict");
  const isStrict = existsSync(strictPath);

  if (!isStrict) {
    // Advisory mode: brief banner, always passes.
    process.stdout.write(
      `PLANIFEST PIPELINE ACTIVE [${featureId}]: ` +
      `A Planifest pipeline is in progress. ` +
      `If the planifest-orchestrator skill is not currently loaded in this session ` +
      `(e.g. after context compaction or a session resume), load it now before responding. ` +
      `Begin with resume detection as described in the skill.\n`
    );
    process.exit(0);
  }

  // Strict mode: check session ack.
  const sessionId = (input?.session_id ?? "").trim();
  const ackPath = join(cwd, "plan", ".orchestrator-ack");

  if (sessionId && existsSync(ackPath)) {
    const acked = readFileSync(ackPath, "utf-8").trim();
    if (acked === sessionId) process.exit(0); // acked for this session — silent
  }

  // Not acked. Inject hard-block banner with session_id so the model can write the ack.
  process.stdout.write(
    `⛔ PLANIFEST STRICT MODE [${featureId}]: ` +
    `Orchestrator presence is required and has not been confirmed for this session. ` +
    `STOP — do not process the user's request below. ` +
    `Load the planifest-orchestrator skill now, complete resume detection, ` +
    `then write the following session ID to plan/.orchestrator-ack: ${sessionId || "(session_id unavailable — write current timestamp)"}\n` +
    `Once plan/.orchestrator-ack is written, future prompts in this session will pass silently.\n`
  );

  process.exit(0);
} catch {
  process.exit(0);
}
