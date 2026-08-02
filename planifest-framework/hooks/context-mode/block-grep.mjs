#!/usr/bin/env node
/**
 * context-mode enforcement hook — block-grep.mjs
 *
 * Intercepts the Grep tool and redirects to ctx_execute shell.
 * All Grep calls are denied unconditionally — Grep has no safe subset
 * in a context-mode environment (any file search floods the context window).
 *
 * Feature:  0000001-context-mode-enforcement-hooks
 * ADR-001:  hookSpecificOutput deny format (not deprecated top-level decision)
 * ADR-003:  unconditional block strategy for Grep
 * ADR-002 (0000017): ported from block-grep.sh — extracts the former
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

  const pattern = input?.tool_input?.pattern ?? "PATTERN";
  const path = input?.tool_input?.path ?? "PATH";
  const reason = `context-mode: Do not use Grep. Use ctx_execute(language:"shell", code:"grep '${pattern}' ${path}") to keep search output in the context-mode sandbox and protect the context window.`;

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
