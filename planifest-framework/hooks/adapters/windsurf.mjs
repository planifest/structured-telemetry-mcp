#!/usr/bin/env node
/**
 * Windsurf Cascade hook adapter — delegating (ADR-003, REQ-016).
 *
 * Reads the Windsurf hook envelope from stdin, dispatches on agent_action_name,
 * and delegates to gate-write.mjs or check-design.mjs via spawnSync.
 * Never contains inline enforcement logic.
 *
 * Block mechanism: exit code 2 (Windsurf pre-hooks).
 *
 * Windsurf envelope:
 *   { agent_action_name, trajectory_id, timestamp, model_name, tool_info }
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const enfDir = join(__dir, "..", "enforcement");

async function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (c) => { data += c; });
    process.stdin.on("end", () => resolve(data.replace(/^﻿/, "")));
    process.stdin.resume();
  });
}

const WRITE_MCP_TOOLS = /write|edit|create|update|delete|remove|patch/i;

try {
  const raw = await readStdin();

  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); }

  const event = (input?.agent_action_name ?? "").toLowerCase();
  const cwd = input?.tool_info?.cwd ?? input?.tool_info?.workspace_root ?? process.cwd();
  const sessionId = input?.trajectory_id ?? "";

  // --- pre_write_code: gate-write ---
  if (event === "pre_write_code") {
    const path = input?.tool_info?.path ?? input?.tool_info?.file_path ?? "";
    const envelope = JSON.stringify({
      session_id: sessionId,
      cwd,
      tool_input: { path },
      event: "PreToolUse",
    });

    const result = spawnSync(
      process.execPath,
      [join(enfDir, "gate-write.mjs")],
      { input: envelope, encoding: "utf-8" }
    );

    if (result.stdout) process.stdout.write(result.stdout);
    process.exit(result.status === 2 ? 2 : 0);
  }

  // --- pre_mcp_tool_use: gate-write for write-type MCP tools ---
  if (event === "pre_mcp_tool_use") {
    const toolName = input?.tool_info?.tool_name ?? input?.tool_info?.name ?? "";
    if (!WRITE_MCP_TOOLS.test(toolName)) process.exit(0);

    const path = input?.tool_info?.tool_input?.path ?? input?.tool_info?.tool_input?.file_path ?? "";
    const envelope = JSON.stringify({
      session_id: sessionId,
      cwd,
      tool_input: { path, tool_name: toolName },
      event: "PreToolUse",
    });

    const result = spawnSync(
      process.execPath,
      [join(enfDir, "gate-write.mjs")],
      { input: envelope, encoding: "utf-8" }
    );

    if (result.stdout) process.stdout.write(result.stdout);
    process.exit(result.status === 2 ? 2 : 0);
  }

  // --- pre_user_prompt: check-design scope injection ---
  if (event === "pre_user_prompt") {
    const envelope = JSON.stringify({
      session_id: sessionId,
      cwd,
      tool_input: {},
      event: "UserPromptSubmit",
    });

    const result = spawnSync(
      process.execPath,
      [join(enfDir, "check-design.mjs")],
      { input: envelope, encoding: "utf-8" }
    );

    if (result.stdout) process.stdout.write(result.stdout);
    process.exit(result.status === 2 ? 2 : 0);
  }

  // Unknown event — pass through silently
  process.exit(0);
} catch {
  // Never block on unexpected errors (NFR-003)
  process.exit(0);
}
