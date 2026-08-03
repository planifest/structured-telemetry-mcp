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
 * ADR (0000026, backlog 0000042): the bare `https?://` substring match
 *   flagged local-only arguments (e.g. `--backend-url http://localhost:3741`)
 *   with no actual outbound fetch involved. Loopback targets (exact host
 *   `localhost` / `127.0.0.1` / `[::1]`) are now exempted from that path —
 *   hostnames are extracted via the WHATWG `URL` parser, not string
 *   matching, specifically because a naive prefix check is bypassable via
 *   `http://localhost.evil.com/` (subdomain) or `http://localhost@evil.com/`
 *   (userinfo) — both contain the literal string `localhost` right after
 *   the scheme but resolve to `evil.com`. `curl`/`wget` invocations are
 *   never exempted by this loopback check — those are still redirected to
 *   ctx_fetch_and_index regardless of target, since a local fetch can still
 *   flood context same as a remote one.
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

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

// Extracts URL-shaped tokens (scheme://... up to the next whitespace or
// shell-meaningful character) and reports whether every one of them
// resolves — via the platform URL parser, not substring matching — to an
// exact loopback host. An unparseable token is treated as non-loopback
// (fail-safe: keep flagging when unsure).
function isLoopbackOnly(command) {
  const urls = command.match(/https?:\/\/[^\s'"`|;&<>]+/g);
  if (!urls || urls.length === 0) return false;
  return urls.every((raw) => {
    try {
      return LOOPBACK_HOSTS.has(new URL(raw).hostname);
    } catch {
      return false;
    }
  });
}

function redirectType(command) {
  if (/\b(grep|rg)\b/.test(command)) return "search";
  if (/\b(curl|wget)\b/.test(command)) return "network";
  if (/https?:\/\//.test(command) && !isLoopbackOnly(command)) return "network";
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
