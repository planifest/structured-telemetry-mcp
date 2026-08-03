#!/usr/bin/env node
/**
 * UserPromptSubmit hook: telemetry failure marker check.
 *
 * Reads plan/.telemetry-failures/ for unacknowledged telemetry emission
 * failure markers (written by emit-phase-start.mjs, emit-phase-end.mjs, and
 * context-pressure.mjs on emission error — see
 * planifest-framework/hooks/telemetry/context-pressure.mjs's header comment
 * for the exact marker JSON shape and the plan/.telemetry-failures/<slug>.json
 * location) and injects a visible reminder into context. This backstops the
 * orchestrator's ADR-002 phase-start check (SKILL.md's Telemetry section)
 * with a deterministic hook, instead of relying purely on the orchestrator's
 * own memory to check at every phase boundary (backlog 0000044, folded into
 * feature 0000026).
 *
 * A marker file existing on disk IS the "unacknowledged" signal — there is no
 * separate acknowledged/unacknowledged flag inside the marker itself. Per
 * telemetry-standards.md's "Failure Detection and Interactive Recovery"
 * protocol, "acknowledged" means the orchestrator surfaced the block-or-
 * proceed question once for that root_cause_key, recorded the human's answer
 * in plan/current/build-log.md, then DELETED the marker. This hook is
 * deliberately read-only: it never deletes or modifies marker files itself —
 * that stays the orchestrator's job, since deletion is what marks a root
 * cause as "already asked about."
 *
 * Receives: JSON on stdin (Claude Code UserPromptSubmit hook input or common envelope)
 * Outputs: JSON { additionalContext: "<string>" } on stdout, or nothing on skip.
 *
 * Always exits 0 — never blocks a turn (ADR-005). Malformed marker JSON is
 * skipped, not fatal — the hook still reports on whatever markers it could
 * parse and never crashes (fail-open, consistent with every other hook in
 * this repo).
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(data.replace(/^﻿/, "")));
    process.stdin.resume();
  });
}

// Best-effort read of every *.json marker in dir. Malformed/unreadable
// entries are skipped individually rather than aborting the whole scan —
// one bad file must never hide the other, valid markers.
function readMarkers(dir) {
  const markers = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return markers;
  }

  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    try {
      const raw = readFileSync(join(dir, entry), "utf-8");
      markers.push(JSON.parse(raw));
    } catch {
      // Malformed/unreadable marker — skip it, never crash (fail-open).
    }
  }

  return markers;
}

function formatMarker(marker) {
  const hook = marker?.hook ?? "unknown-hook";
  const errorType = marker?.error_type ?? "unknown-error-type";
  const errorMessage = marker?.error_message ?? "unknown-error-message";
  const occurrences = marker?.occurrences ?? "unknown";
  return `  - hook: ${hook} | error_type: ${errorType} | error_message: ${errorMessage} | occurrences: ${occurrences}`;
}

try {
  const raw = await readStdin();
  const input = JSON.parse(raw);
  const cwd = input?.cwd ?? process.cwd();

  const markersDir = join(cwd, "plan", ".telemetry-failures");
  if (!existsSync(markersDir)) process.exit(0);

  const markers = readMarkers(markersDir);
  if (markers.length === 0) process.exit(0);

  const lines = markers.map(formatMarker).join("\n");
  const additionalContext =
    "[Planifest] Unacknowledged telemetry failure marker(s) found under plan/.telemetry-failures/:\n\n" +
    lines +
    "\n\nPer telemetry-standards.md's Failure Detection and Interactive Recovery protocol, " +
    "surface the block-or-proceed question for each unacknowledged root_cause_key before phase " +
    "work begins, record the human's answer in plan/current/build-log.md, then delete the marker " +
    "(clearing a marker means acknowledged, not resolved). This hook only surfaces the reminder — " +
    "the block-or-proceed decision and marker deletion remain the orchestrator's responsibility.";

  process.stdout.write(JSON.stringify({ additionalContext }));
  process.exit(0);
} catch {
  // UserPromptSubmit must never block a turn — silent fallback (ADR-005).
  process.exit(0);
}
