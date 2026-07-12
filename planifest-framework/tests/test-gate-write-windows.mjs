/**
 * Regression test: gate-write.mjs Windows path normalisation (REQ-012, ADR-005)
 *
 * Written in JavaScript to avoid Git Bash / Windows Node.js path interpolation issues.
 * Called by test-gate-write-windows.sh via `node test-gate-write-windows.mjs`.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GATE_WRITE = resolve(__dirname, "../hooks/enforcement/gate-write.mjs");

let PASS = 0;
let FAIL = 0;

function assert_equals(expected, actual, label) {
  if (String(expected) === String(actual)) {
    console.log(`  PASS: ${label}`);
    PASS++;
  } else {
    console.log(`  FAIL: ${label}`);
    console.log(`        expected: ${expected}`);
    console.log(`        actual:   ${actual}`);
    FAIL++;
  }
}

// Create isolated temp dir using os.tmpdir() — always a proper OS path
const TMPDIR = join(os.tmpdir(), `planifest-gw-test-${process.pid}`);
mkdirSync(TMPDIR, { recursive: true });

process.on("exit", () => {
  try { rmSync(TMPDIR, { recursive: true, force: true }); } catch {}
});

function makeWorkDir(key, { sentinel = false, designPaths = null } = {}) {
  const dir = join(TMPDIR, key);
  mkdirSync(join(dir, "plan", "current"), { recursive: true });

  if (sentinel) {
    writeFileSync(join(dir, "plan", ".orchestrator-active"), "");
  }

  if (designPaths) {
    const content = `## Component Paths\n${designPaths.map(p => `- ${p}`).join("\n")}\n\n## Scope\n- In: test\n`;
    writeFileSync(join(dir, "plan", "current", "design.md"), content);
  }

  return dir;
}

function runGateWrite(cwd, target) {
  const payload = JSON.stringify({ cwd, tool_input: { file_path: target } });

  const result = spawnSync("node", [GATE_WRITE], {
    input: payload,
    encoding: "utf8",
  });

  return result.status ?? 1;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log("\n=== REQ-012: gate-write.mjs Windows path normalisation ===");

console.log("\n--- Always-permitted prefix: plan/ ---");

{
  const dir = makeWorkDir("plan-design", { sentinel: true });
  assert_equals(0, runGateWrite(dir, "plan/current/design.md"), "plan/current/design.md is always permitted");
}
{
  const dir = makeWorkDir("plan-archive", { sentinel: true });
  assert_equals(0, runGateWrite(dir, "plan/archive/feature/build-log.md"), "plan/archive/ path is always permitted");
}
{
  const dir = makeWorkDir("plan-sentinel", { sentinel: true });
  assert_equals(0, runGateWrite(dir, "plan/.orchestrator-active"), "plan/.orchestrator-active is always permitted");
}

console.log("\n--- Always-permitted file basename: pause.md (REQ-006) ---");

{
  const dir = makeWorkDir("pause-with-sentinel", { sentinel: true });
  assert_equals(0, runGateWrite(dir, "plan/current/pause.md"), "pause.md permitted with sentinel");
}
{
  // pause.md should pass via ALWAYS_PERMITTED_FILES basename match even without sentinel
  const dir = makeWorkDir("pause-no-sentinel", { sentinel: false });
  assert_equals(0, runGateWrite(dir, "plan/current/pause.md"), "pause.md permitted without sentinel");
}

console.log("\n--- Always-permitted file basename: .skips ---");

{
  const dir = makeWorkDir("skips", { sentinel: true });
  assert_equals(0, runGateWrite(dir, "plan/current/.skips"), ".skips is always permitted");
}

console.log("\n--- Always-permitted prefix: docs/ ---");

{
  const dir = makeWorkDir("docs", { sentinel: true });
  assert_equals(0, runGateWrite(dir, "docs/component-registry.md"), "docs/ path is always permitted");
}

console.log("\n--- Component path: matching path is permitted ---");

{
  const dir = makeWorkDir("comp-match", { sentinel: true, designPaths: ["planifest-framework/"] });
  const code = runGateWrite(dir, "planifest-framework/hooks/enforcement/gate-write.mjs");
  assert_equals(0, code, "planifest-framework/ path permitted when in Component Paths");
}

console.log("\n--- Component path: non-matching path is blocked ---");

{
  const dir = makeWorkDir("comp-no-match", { sentinel: true, designPaths: ["planifest-framework/"] });
  const code = runGateWrite(dir, "src/some-other-component/index.ts");
  assert_equals(2, code, "path outside Component Paths is blocked (exit 2)");
}

console.log("\n--- Sentinel enforcement: plan/current/ blocked without sentinel ---");

{
  const dir = makeWorkDir("no-sentinel-design", { sentinel: false });
  assert_equals(2, runGateWrite(dir, "plan/current/design.md"), "plan/current/ write blocked without sentinel");
}
{
  const dir = makeWorkDir("no-sentinel-brief", { sentinel: false });
  assert_equals(0, runGateWrite(dir, "plan/current/feature-brief.md"), "feature-brief.md permitted without sentinel");
}

console.log("\n--- Windows path regression: norm() in source file ---");

import { readFileSync } from "node:fs";
const src = readFileSync(GATE_WRITE, "utf8");
assert_equals(true, src.includes("cwdPrefix") || src.includes("normCwd"), "gate-write.mjs uses norm()-based comparison (REQ-012 fix)");
assert_equals(false, src.includes("cwdWithSep"), "gate-write.mjs does not contain old cwdWithSep approach");

// ── Summary ───────────────────────────────────────────────────────────────────

console.log("");
console.log(`Results: ${PASS} passed, ${FAIL} failed ${FAIL === 0 ? "✓" : "✗"}`);
process.exit(FAIL > 0 ? 1 : 0);
