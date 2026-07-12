#!/usr/bin/env node
/**
 * PreToolUse hook: ratchet — blocks silent weakening of acceptance criteria
 * and scope during loops/reversals (REQ-018, ADR-004, ADR-007, feature 0000016).
 * Same family as gate-write.mjs.
 *
 * Armed only while a loop or reversal is in flight: a plan/current/loop-state-*.md
 * file with status "active" exists. When disarmed, every write passes.
 *
 * Weakening = removing a "- [ ]" checklist line from an "## Acceptance Criteria"
 * section, or removing a bullet from an "## In Scope" / "## Scope" section, of a
 * plan/current/ markdown artifact. Additions (strengthening) always pass.
 *
 * Human approval path (ADR-004): plan/current/.ratchet-approve lists repo-relative
 * paths whose weakening is approved. A matching line is consumed on use
 * (single-use); every consumption is appended to plan/current/ratchet-log.md.
 * Agents must never write the marker — that is a Hard Limit in loop-runner.
 *
 * Exit codes: 0 = pass, 2 = block. Unexpected errors exit 0 — hooks never block
 * a session unexpectedly (matching gate-write.mjs contract).
 */

import {
  appendFileSync, existsSync, readFileSync, readdirSync, realpathSync,
  unlinkSync, writeFileSync,
} from "node:fs";
import { join, normalize, relative, resolve } from "node:path";

function realpathSafe(p) {
  try { return realpathSync(p); } catch { return resolve(p); }
}

function readStdin() {
  return new Promise((res) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (c) => { data += c; });
    process.stdin.on("end", () => res(data.replace(/^﻿/, "")));
    process.stdin.resume();
  });
}

function norm(p) {
  return normalize(p).replace(/\\/g, "/");
}

function loopActive(planCurrent) {
  let entries;
  try { entries = readdirSync(planCurrent); } catch { return false; }
  for (const f of entries) {
    if (!/^loop-state-.*\.md$/.test(f)) continue;
    try {
      const head = readFileSync(join(planCurrent, f), "utf-8").slice(0, 500);
      if (/^status:\s*["']?active["']?\s*$/m.test(head)) return true;
    } catch { /* unreadable state = not armed by it */ }
  }
  return false;
}

/** Extract guarded lines: AC checklist items + scope bullets, per section. */
function guardedLines(text) {
  const lines = [];
  const sections = [
    { re: /^##\s+Acceptance Criteria\s*$/im, item: /^\s*-\s*\[[ x]\]\s*(.+)$/ },
    { re: /^##\s+(In Scope|Scope)\s*$/im, item: /^\s*-\s*(?!\[)(.+)$/ },
  ];
  for (const { re, item } of sections) {
    const m = re.exec(text);
    if (!m) continue;
    const rest = text.slice(m.index + m[0].length);
    const next = rest.search(/^##\s+/m);
    const body = next === -1 ? rest : rest.slice(0, next);
    for (const line of body.split(/\r?\n/)) {
      const im = line.match(item);
      if (im) lines.push(im[im.length - 1].trim());
    }
  }
  return lines;
}

function proposedContent(toolInput, currentText) {
  if (typeof toolInput.content === "string") return toolInput.content; // Write
  if (typeof toolInput.new_string === "string" && typeof toolInput.old_string === "string") {
    if (currentText === null) return null;
    return toolInput.replace_all
      ? currentText.split(toolInput.old_string).join(toolInput.new_string)
      : currentText.replace(toolInput.old_string, toolInput.new_string);
  }
  return null;
}

function consumeApproval(planCurrent, relPath, removedLines) {
  const markerPath = join(planCurrent, ".ratchet-approve");
  if (!existsSync(markerPath)) return false;
  let lines;
  try { lines = readFileSync(markerPath, "utf-8").split(/\r?\n/); } catch { return false; }
  const idx = lines.findIndex((l) => norm(l.replace(/#.*$/, "").trim()) === norm(relPath));
  if (idx === -1) return false;
  lines.splice(idx, 1);
  const remaining = lines.filter((l) => l.trim() !== "");
  try {
    if (remaining.length === 0) unlinkSync(markerPath);
    else writeFileSync(markerPath, remaining.join("\n") + "\n");
    appendFileSync(
      join(planCurrent, "ratchet-log.md"),
      `- ${new Date().toISOString()} — approved weakening of \`${relPath}\` consumed marker; removed: ${removedLines.map((l) => JSON.stringify(l)).join(", ")}\n`,
    );
  } catch { /* logging best-effort */ }
  return true;
}

async function main() {
  const raw = await readStdin();
  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); }

  const toolInput = input?.tool_input ?? input?.toolInput ?? {};
  const filePath = toolInput.file_path ?? toolInput.filePath;
  if (typeof filePath !== "string") process.exit(0);

  const projectRoot = realpathSafe(process.cwd());
  const planCurrent = join(projectRoot, "plan", "current");
  const relPath = norm(relative(projectRoot, realpathSafe(filePath)));

  // Only guard plan/current/ markdown artifacts (not the state/log files themselves)
  if (!relPath.startsWith("plan/current/") || !relPath.endsWith(".md")) process.exit(0);
  const base = relPath.split("/").pop() ?? "";
  if (/^loop-state-/.test(base) || base === "ratchet-log.md" || base === "build-log.md") process.exit(0);

  // Armed only while a loop is active
  if (!loopActive(planCurrent)) process.exit(0);

  let currentText = null;
  try { currentText = readFileSync(resolve(filePath), "utf-8"); } catch { process.exit(0); }

  const next = proposedContent(toolInput, currentText);
  if (next === null) process.exit(0);

  const before = guardedLines(currentText);
  const after = new Set(guardedLines(next));
  const removed = before.filter((l) => !after.has(l));
  if (removed.length === 0) process.exit(0); // strengthening or neutral

  if (consumeApproval(planCurrent, relPath, removed)) process.exit(0);

  const reason = [
    `Ratchet: this write weakens ${relPath} while a loop is active.`,
    ...removed.map((l) => `  removed: "${l}"`),
    "Loops may strengthen criteria/scope but never weaken them (ADR-007).",
    `If this weakening is intentional, a HUMAN must add the line "${relPath}"`,
    "to plan/current/.ratchet-approve and re-run the write (single-use, ADR-004).",
    "Agents must not write that marker themselves.",
  ].join("\n");
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  }));
  process.exit(2);
}

main().catch(() => process.exit(0));
