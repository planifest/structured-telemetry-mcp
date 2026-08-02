#!/usr/bin/env node
/**
 * context-mode enforcement hook — block-webfetch.mjs
 *
 * Intercepts the WebFetch tool and redirects to ctx_fetch_and_index + ctx_search.
 * All WebFetch calls are denied unconditionally — WebFetch always returns the
 * full response body into the context window with no size control.
 *
 * Feature:  0000001-context-mode-enforcement-hooks
 * ADR-001:  hookSpecificOutput deny format (not deprecated top-level decision)
 * ADR-003:  unconditional block strategy for WebFetch
 * ADR-002 (0000017): ported from block-webfetch.sh — extracts the former
 *   node-fallback logic as the sole implementation. No jq dependency,
 *   no Unix-shell (Git Bash/WSL) requirement. Identical behaviour on
 *   every platform where Node.js is present.
 * Upstream: to be contributed to https://github.com/mksglu/context-mode
 *
 * Input  (stdin): Claude Code PreToolUse JSON payload
 * Output (stdout): hookSpecificOutput JSON deny decision
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

async function main() {
  const raw = await readStdin();
  let input;
  try { input = JSON.parse(raw); } catch { input = {}; }

  const url = input?.tool_input?.url ?? "URL";
  const reason = `context-mode: Do not use WebFetch. Instead: (1) ctx_fetch_and_index(url:"${url}") to ingest and index the page content, then (2) ctx_search(queries:["..."]) to retrieve relevant sections. This keeps the response body in the sandbox and protects the context window.`;

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  }) + "\n");
  process.exit(0);
}

main().catch(() => process.exit(0)); // never block the session on unexpected errors (fail-open)
