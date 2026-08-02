#!/usr/bin/env node
/**
 * context-mode enforcement hook — block-bash.mjs
 *
 * Intercepts Bash tool calls that match context-flooding patterns.
 * Commands whose leading token is in the allowlist are always permitted.
 * Pattern matching applies only after the allowlist check.
 *
 * Feature:  0000001-context-mode-enforcement-hooks
 * ADR-001:  hookSpecificOutput deny format
 * ADR-002:  hardcoded allowlist (configurable allowlist deferred)
 * ADR-003:  pattern-based blocking for Bash (Bash has a safe majority)
 * ADR-002 (0000017): ported from block-bash.sh — extracts the former
 *   node-fallback logic as the sole implementation. No jq dependency,
 *   no Unix-shell (Git Bash/WSL) requirement. Identical behaviour on
 *   every platform where Node.js is present.
 * Upstream: to be contributed to https://github.com/mksglu/context-mode
 *
 * Input  (stdin): Claude Code PreToolUse JSON payload
 * Output (stdout): hookSpecificOutput JSON deny decision, or empty (allow)
 * Exit:   0 always — never blocks the session on unexpected errors (fail-open)
 *
 * Runtime dependency: Node.js only.
 */

function readStdin() {
  return new Promise((res) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (c) => { data += c; });
    process.stdin.on("end", () => res(data.replace(/^﻿/, "")));
    process.stdin.resume();
  });
}

// ---------------------------------------------------------------------------
// ALLOWLIST CHECK (ADR-002)
// Checks the leading command token only — not the full pipeline.
// Consequence: `git log | grep feat` is allowed (git is leading).
// See quirks Q-001 for the `ls | grep` edge case.
// ---------------------------------------------------------------------------

const LEADING_ALLOWLIST = new Set(["git", "mkdir", "rm", "mv", "cd", "ls"]);
const LEADING_PAIR_ALLOWLIST = new Set(["npm install", "pip install"]);

function isAllowlisted(command) {
  const parts = command.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return false;
  if (LEADING_ALLOWLIST.has(parts[0])) return true;
  if (parts.length >= 2 && LEADING_PAIR_ALLOWLIST.has(`${parts[0]} ${parts[1]}`)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// BLOCKED PATTERN CHECK (ADR-003)
// Whole-word matching to avoid false positives on substrings.
// e.g. `cargo` does not match `rg`; `--arg` does not match `rg`.
// ---------------------------------------------------------------------------

function redirectType(command) {
  if (/\b(grep|rg)\b/.test(command)) return "search";
  if (/\b(curl|wget)\b/.test(command) || /https?:\/\//.test(command)) return "network";
  return null;
}

function denyDecision(reason) {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  });
}

async function main() {
  const raw = await readStdin();
  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); }

  const command = input?.tool_input?.command ?? "";

  if (isAllowlisted(command)) process.exit(0);

  const type = redirectType(command);
  if (!type) process.exit(0); // no blocked pattern — allow

  const redirectMsg = type === "search"
    ? 'Use ctx_execute(language:"shell", code:"grep ...") to keep search output in the context-mode sandbox.'
    : 'Use ctx_fetch_and_index(url:"...") to ingest the URL, then ctx_search(queries:["..."]) to retrieve content.';

  const reason = `context-mode: Blocked Bash command. ${redirectMsg} Original command: ${command}`;
  process.stdout.write(denyDecision(reason) + "\n");
  process.exit(0);
}

main().catch(() => process.exit(0)); // never block the session on unexpected errors (fail-open)
