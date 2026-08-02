#!/usr/bin/env node
/**
 * PreToolUse hook: phase_start telemetry emission.
 *
 * Fires on first tool use within a phase. Guards against re-emission using a
 * flag file keyed by session_id + phase (DD-001, ADR-003).
 *
 * Usage:  node emit-phase-start.mjs <phase>
 *   e.g.  node emit-phase-start.mjs spec
 *
 * Session ID fallback: reads/creates {cwd}/.claude/.planifest-session when
 * PLANIFEST_SESSION_ID is absent (R-005 mitigation, ADR-003).
 *
 * Silent on all errors (ADR-005). No retries. 3-second abort on HTTP.
 *
 * Durable failure marker (req-002, ADR-002): on emission failure this hook
 * still exits 0 and never blocks (ADR-005 unchanged) — but it now also
 * writes a best-effort marker file recording the root cause, instead of
 * swallowing the error with no trace.
 *
 *   Location: {cwd}/plan/.telemetry-failures/<slug>.json
 *     (plan/, not .claude/ — durable, git-visible, survives across sessions;
 *     a sibling of plan/.orchestrator-active, deliberately outside
 *     plan/current/ so it is never swept up by ratchet-check or archived at
 *     the P7 ship step.)
 *
 *   One file per distinct root cause — the filename is derived from
 *   `${hook}::${error_type}::${slugified error message}`. A repeat of the
 *   same failure updates the existing file (last_seen, occurrences); a
 *   genuinely different failure gets its own file. Clearing a marker
 *   (after the human is asked and answers, req-003) is a plain file delete.
 *
 *   Marker JSON shape:
 *     {
 *       "hook": "emit-phase-start" | "emit-phase-end" | "context-pressure",
 *       "root_cause_key": "<hook>::<error_type>::<slugified message>",
 *       "error_type": string,    // e.g. "TypeError", "AbortError", "http_500"
 *       "error_message": string,
 *       "phase": string | null,
 *       "session_id": string | null,
 *       "first_seen": ISO 8601 timestamp,
 *       "last_seen": ISO 8601 timestamp,
 *       "occurrences": number
 *     }
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

const BACKEND_URL = process.env.PLANIFEST_TELEMETRY_URL;
const PHASE = process.argv[2];

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(data.replace(/^\uFEFF/, "")));
    process.stdin.resume();
  });
}

function getSessionId(input, cwd) {
  // Priority 1: explicit env var
  if (process.env.PLANIFEST_SESSION_ID) return process.env.PLANIFEST_SESSION_ID;
  // Priority 2: hook input session_id field
  if (input?.session_id) return input.session_id;
  // Priority 3: UUID from transcript path filename
  if (input?.transcript_path) {
    const m = input.transcript_path.match(/([a-f0-9-]{36})\.jsonl$/i);
    if (m) return m[1];
  }
  // Priority 4: project-scoped session file (R-005 mitigation)
  try {
    const sessionFile = join(cwd, ".claude", ".planifest-session");
    if (existsSync(sessionFile)) return readFileSync(sessionFile, "utf-8").trim();
    const id = randomUUID();
    mkdirSync(dirname(sessionFile), { recursive: true });
    writeFileSync(sessionFile, id);
    return id;
  } catch {
    return `pid-${process.pid}`;
  }
}

function getFlagPath(sessionId) {
  const dir = join(tmpdir(), "planifest-telemetry");
  return join(dir, `phase-start-${sessionId}-${PHASE}`);
}

// Best-effort durable failure marker (req-002, ADR-002) — see file header for
// the format contract. Never throws; a failure here is swallowed so it can
// never affect the hook's exit-zero/never-block behaviour (ADR-005).
function recordTelemetryFailure(hookName, err, context = {}) {
  try {
    const cwd = context.cwd ?? process.cwd();
    const errorType = context.errorType ?? err?.name ?? err?.constructor?.name ?? "Error";
    const errorMessage = String(err?.message ?? err ?? "unknown error");
    const slug =
      errorMessage.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) ||
      "unknown";
    const rootCauseKey = `${hookName}::${errorType}::${slug}`;
    const dir = join(cwd, "plan", ".telemetry-failures");
    // Colon-free filename (Windows-safe) — "::" separators collapse to "--".
    // "::" segment separators are preserved as "--"; unsafe characters within
    // each segment collapse to a single "-" (Windows-safe filename).
    const fileSlug = rootCauseKey
      .split("::")
      .map((seg) => seg.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "unknown")
      .join("--");
    const markerPath = join(dir, `${fileSlug}.json`);

    mkdirSync(dir, { recursive: true });

    const now = new Date().toISOString();
    let occurrences = 1;
    let firstSeen = now;
    if (existsSync(markerPath)) {
      try {
        const prev = JSON.parse(readFileSync(markerPath, "utf-8"));
        if (typeof prev.occurrences === "number") occurrences = prev.occurrences + 1;
        if (prev.first_seen) firstSeen = prev.first_seen;
      } catch {
        // Corrupt/unreadable prior marker — overwrite fresh below.
      }
    }

    const marker = {
      hook: hookName,
      root_cause_key: rootCauseKey,
      error_type: errorType,
      error_message: errorMessage,
      phase: context.phase ?? null,
      session_id: context.sessionId ?? null,
      first_seen: firstSeen,
      last_seen: now,
      occurrences,
    };

    const tmpMarkerPath = `${markerPath}.tmp`;
    writeFileSync(tmpMarkerPath, JSON.stringify(marker, null, 2));
    renameSync(tmpMarkerPath, markerPath);
  } catch {
    // Marker write is best-effort — never let this throw (ADR-005).
  }
}

let cwd;
let sessionId;

try {
  // Sentinel check: no telemetry URL or no phase arg = silent exit (REQ-004)
  if (!BACKEND_URL || !PHASE) process.exit(0);

  const raw = await readStdin();
  const input = JSON.parse(raw);
  cwd = input?.cwd ?? process.cwd();
  sessionId = getSessionId(input, cwd);
  const flagPath = getFlagPath(sessionId);

  // Deduplication guard — exit 0 if already emitted this session+phase (ADR-003)
  if (existsSync(flagPath)) process.exit(0);

  // Write flag file atomically with ISO 8601 start timestamp (used by emit-phase-end.mjs)
  const timestamp = new Date().toISOString();
  const flagDir = dirname(flagPath);
  mkdirSync(flagDir, { recursive: true });
  const tmpPath = `${flagPath}.tmp`;
  writeFileSync(tmpPath, timestamp);
  renameSync(tmpPath, flagPath);

  const event = {
    schema_version: "1.0",
    event: "phase_start",
    session_id: sessionId,
    phase: PHASE,
    agent: `planifest-${PHASE}-agent`,
    tool: process.env.PLANIFEST_TOOL ?? "claude-code",
    model: process.env.CLAUDE_API_MODEL ?? "unknown",
    mcp_mode: "none",
    timestamp,
    data: { phase_name: PHASE },
  };

  // Fire-and-forget: abort after 3 s (ADR-005, NFR)
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 3_000);
  try {
    const res = await fetch(`${BACKEND_URL}/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      signal: ac.signal,
    });
    if (!res.ok) {
      const httpErr = new Error(`emission POST failed: HTTP ${res.status}`);
      httpErr.name = `http_${res.status}`;
      throw httpErr;
    }
  } finally {
    clearTimeout(timer);
  }
} catch (err) {
  // PreToolUse must never block the session — silent fallback (ADR-005).
  recordTelemetryFailure("emit-phase-start", err, { cwd, phase: PHASE, sessionId });
}
