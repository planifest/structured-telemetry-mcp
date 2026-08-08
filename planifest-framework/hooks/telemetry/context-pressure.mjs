#!/usr/bin/env node
/**
 * PostToolUse hook: context pressure monitor for structured telemetry.
 *
 * Emits a `context_pressure` event to the structured telemetry MCP backend
 * when estimated context fill exceeds THRESHOLD_PCT (default: 70%).
 *
 * Installed only when both --structured-telemetry-mcp and --context-mode-mcp
 * are active at setup time. See plan/current/design.md — Context Pressure Hook.
 *
 * Fill % is estimated from transcript file size. This is a proxy metric —
 * it grows proportionally with context use within a session and resets at
 * session start. It does not account for compaction events.
 *
 * Silent on all errors (NFR-001). No local fallback (NFR-002) — a failure
 * is never queued or persisted for later delivery, it is dropped (with a
 * durable marker recording *that* it was dropped, per req-002/ADR-002).
 *
 * Bounded retry for connection-refused only (0000018, filed against this
 * repo directly): a `structured-telemetry-mcp` deploy briefly leaves no
 * listener on BACKEND_URL between the old daemon exiting and the new one
 * binding the port (req-001/002 checkpoint on exit; launchd/systemd then
 * relaunches). A hook firing in that ~1-2s window saw a network-level
 * connection failure (fetch's TypeError, not an HTTP error status) and
 * treated a routine, self-correcting restart as a hard failure, tripping
 * the durable-marker/human-interrupt path for something that was never
 * actually wrong. Retries up to 2 times (3 attempts total), fixed 300ms
 * gaps, only on a network-level fetch failure — never on an HTTP error
 * response (4xx/5xx are real failures, not a listener gap, and are not
 * retried). Total added worst-case latency ~600ms, still well inside a
 * hook's "must be fast" budget. This is not a general retry/queue
 * mechanism — a backend that is still unreachable after 3 attempts is
 * still recorded via the durable marker exactly as before.
 *
 * Durable failure marker (req-002, ADR-002): on emission failure this hook
 * still exits 0 and never blocks (NFR-001 unchanged) — but it now also
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

import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const THRESHOLD_PCT = 70;
// Rough estimate: ~900 KB of JSONL transcript ≈ full 200K token context window.
// 70% threshold ≈ 630 KB.
const ESTIMATED_MAX_BYTES = 900_000;
const BACKEND_URL = process.env.PLANIFEST_TELEMETRY_URL ?? "http://localhost:3741";

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(data.replace(/^\uFEFF/, "")));
    process.stdin.on("error", reject);
    process.stdin.resume();
  });
}

function getSessionId(input) {
  if (input.transcript_path) {
    const match = input.transcript_path.match(/([a-f0-9-]{36})\.jsonl$/i);
    if (match) return match[1];
  }
  if (input.session_id) return input.session_id;
  return `pid-${process.ppid}`;
}

// Declared product_id source (req-001): product.yml's top-level `id` field,
// resolved relative to the hook's own `cwd`. No git-derived or path-shaped
// fallback — an absent/unparseable/`id`-less product.yml is a hard failure
// that propagates to the caller's top-level try/catch and is routed through
// recordTelemetryFailure() below (never a silent path-shaped fallback).
function readProductId(cwd) {
  const text = readFileSync(join(cwd, "product.yml"), "utf-8");
  for (const raw of text.split(/\r?\n/)) {
    const noComment = raw.replace(/#.*$/, "");
    const m = noComment.match(/^id:\s*(.*)$/);
    if (!m) continue;
    let value = m[1].trim();
    if (/^"[^"]*"$/.test(value) || /^'[^']*'$/.test(value)) {
      value = value.slice(1, -1).trim();
    } else if (/["']/.test(value)) {
      throw new Error("product.yml id field is malformed (unbalanced quoting)");
    }
    if (!value || /^(null|~)$/i.test(value)) {
      throw new Error("product.yml id field is empty");
    }
    return value;
  }
  throw new Error("product.yml has no top-level id field");
}

// Best-effort durable failure marker (req-002, ADR-002) — see file header for
// the format contract. Never throws; a failure here is swallowed so it can
// never affect the hook's exit-zero/never-block behaviour (NFR-001).
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
    // Marker write is best-effort — never let this throw (NFR-001).
  }
}

let cwd;
let sessionId;

try {
  const raw = await readStdin();
  const input = JSON.parse(raw);
  cwd = input?.cwd ?? process.cwd();

  if (!input.transcript_path) {
    process.exit(0);
  }

  let transcriptBytes;
  try {
    transcriptBytes = statSync(input.transcript_path).size;
  } catch {
    process.exit(0);
  }

  const context_fill_pct =
    Math.min(100, Math.round((transcriptBytes / ESTIMATED_MAX_BYTES) * 1000) / 10);

  if (context_fill_pct <= THRESHOLD_PCT) {
    process.exit(0);
  }

  sessionId = getSessionId(input);

  const event = {
    schema_version: "1.0",
    event: "context_pressure",
    product_id: readProductId(cwd),
    session_id: sessionId,
    // "monitoring" is not a valid envelope `phase` value (see telemetry-standards.md's
    // enum) — context-pressure is a session-wide check the orchestrator owns
    // (see backlog 0000012), so it maps to "orchestrator" rather than a phase of its own.
    phase: "orchestrator",
    agent: "context-pressure-hook",
    tool: "claude-code",
    model: process.env.CLAUDE_API_MODEL ?? "unknown",
    mcp_mode: "workspace+context",
    timestamp: new Date().toISOString(),
    data: {
      context_fill_pct,
      unused_sources: [],
      trigger: "threshold_exceeded",
    },
  };

  // Fire-and-forget: abort each attempt after 3 s to keep the hook fast.
  const RETRY_DELAYS_MS = [300, 300]; // up to 2 retries (3 attempts total)
  let lastErr;
  for (let attempt = 0; ; attempt++) {
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
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      // Only retry a network-level failure (e.g. ECONNREFUSED surfaced by
      // fetch as a TypeError) — a real HTTP error status is never a
      // listener-gap symptom and is not worth retrying.
      const isNetworkFailure = !(err?.name ?? "").startsWith("http_");
      if (!isNetworkFailure || attempt >= RETRY_DELAYS_MS.length) break;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
  }
  if (lastErr) throw lastErr;
} catch (err) {
  // PostToolUse must never block the session — silent fallback (NFR-001).
  recordTelemetryFailure("context-pressure", err, { cwd, phase: "monitoring", sessionId });
}
