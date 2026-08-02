#!/usr/bin/env node
/**
 * Stop hook: phase_end telemetry emission.
 *
 * Fires at the end of each response turn. Reads the start timestamp from the
 * phase-start flag file to compute duration_ms (ADR-003, REQ-002).
 *
 * Usage:  node emit-phase-end.mjs <phase>
 *   e.g.  node emit-phase-end.mjs spec
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
import { join } from "node:path";

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
  if (process.env.PLANIFEST_SESSION_ID) return process.env.PLANIFEST_SESSION_ID;
  if (input?.session_id) return input.session_id;
  if (input?.transcript_path) {
    const m = input.transcript_path.match(/([a-f0-9-]{36})\.jsonl$/i);
    if (m) return m[1];
  }
  try {
    const sessionFile = join(cwd, ".claude", ".planifest-session");
    if (existsSync(sessionFile)) return readFileSync(sessionFile, "utf-8").trim();
  } catch { /* silent */ }
  return `pid-${process.pid}`;
}

function getFlagPath(sessionId) {
  return join(tmpdir(), "planifest-telemetry", `phase-start-${sessionId}-${PHASE}`);
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
  const now = Date.now();

  // Read start timestamp from flag file for duration_ms (ADR-003)
  let duration_ms;
  try {
    const flagPath = getFlagPath(sessionId);
    if (existsSync(flagPath)) {
      const startTs = new Date(readFileSync(flagPath, "utf-8").trim()).getTime();
      if (!isNaN(startTs)) duration_ms = now - startTs;
    }
  } catch { /* no flag file = omit duration */ }

  const event = {
    schema_version: "1.0",
    event: "phase_end",
    session_id: sessionId,
    phase: PHASE,
    agent: `planifest-${PHASE}-agent`,
    tool: process.env.PLANIFEST_TOOL ?? "claude-code",
    model: process.env.CLAUDE_API_MODEL ?? "unknown",
    mcp_mode: "none",
    timestamp: new Date().toISOString(),
    data: {
      phase_name: PHASE,
      status: "pass",
      ...(duration_ms !== undefined ? { duration_ms } : {}),
    },
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
  // Stop hook must never block the session — silent fallback (ADR-005).
  recordTelemetryFailure("emit-phase-end", err, { cwd, phase: PHASE, sessionId });
}
