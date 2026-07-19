#!/usr/bin/env node
/**
 * consistency-check.mjs — deterministic cross-artifact consistency validation
 * over plan/current/ (REQ-014, feature 0000016). The cheapest verifier layer:
 * pure file parsing, no model, no network. Run standalone or from the
 * planifest-design-critic skill.
 *
 * Usage: node consistency-check.mjs [planCurrentDir]   (default: plan/current)
 *
 * Checks:
 *   1. Story traceability — every requirement file names a Source user story
 *   2. Acceptance criteria — no requirement exceeds 3 criteria in its
 *      "## Acceptance Criteria" section
 *   3. ADR references — every ADR-NNN referenced anywhere resolves to a file
 *      in adr/
 *   4. Risk mitigations — every R-NNN row in risk-register.md has a non-empty
 *      Mitigation column
 *   5. Design scope — design.md declares a Scope (or Component Paths) section
 *      so gate-write has component paths to enforce
 *
 * Exit codes: 0 = clean, 1 = findings (listed on stdout).
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? join(process.cwd(), "plan", "current");
const findings = [];

function read(p) {
  try { return readFileSync(p, "utf-8"); } catch { return null; }
}

function section(text, heading) {
  // Returns the body of "## {heading}" up to the next "## " heading.
  const re = new RegExp(`^##\\s+${heading}\\s*$`, "im");
  const m = re.exec(text);
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length);
  const next = rest.search(/^##\s+/m);
  return next === -1 ? rest : rest.slice(0, next);
}

if (!existsSync(dir)) {
  console.error(`consistency-check: no such directory: ${dir}`);
  process.exit(1);
}

// ---- 1 + 2: requirement files --------------------------------------------
const reqDir = join(dir, "requirements");
const reqFiles = existsSync(reqDir)
  ? readdirSync(reqDir).filter((f) => f.endsWith(".md"))
  : [];

for (const f of reqFiles) {
  const text = read(join(reqDir, f)) ?? "";

  // 1. story traceability
  if (!/\*\*Source:\*\*\s*US-\d+/.test(text)) {
    findings.push(`${f}: no Source user story (US-nnn) — story↔requirement traceability broken`);
  }

  // 2. ≤3 acceptance criteria (counted inside the AC section only)
  const ac = section(text, "Acceptance Criteria");
  if (ac !== null) {
    const count = (ac.match(/^\s*-\s*\[[ x]\]/gim) ?? []).length;
    if (count > 3) {
      findings.push(`${f}: ${count} acceptance criteria (max 3 per requirement — split the story)`);
    }
  }
}

// ---- 3: orphaned ADR references -------------------------------------------
const adrDir = join(dir, "adr");
const adrIds = new Set(
  (existsSync(adrDir) ? readdirSync(adrDir) : [])
    .map((f) => f.match(/^(ADR-\d{3})/)?.[1])
    .filter(Boolean),
);

function scanAdrRefs(relPath, text) {
  for (const ref of new Set(text.match(/ADR-\d{3}/g) ?? [])) {
    if (!adrIds.has(ref)) {
      findings.push(`${relPath}: references ${ref} but no such file exists in adr/`);
    }
  }
}
for (const f of reqFiles) scanAdrRefs(`requirements/${f}`, read(join(reqDir, f)) ?? "");
for (const f of ["design.md", "execution-plan.md", "scope.md"]) {
  const t = read(join(dir, f));
  if (t) scanAdrRefs(f, t);
}
// ADRs may reference each other too
for (const f of existsSync(adrDir) ? readdirSync(adrDir).filter((x) => x.endsWith(".md")) : []) {
  scanAdrRefs(`adr/${f}`, read(join(adrDir, f)) ?? "");
}

// ---- 4: risks have mitigations ---------------------------------------------
const risks = read(join(dir, "risk-register.md"));
if (risks !== null) {
  for (const line of risks.split(/\r?\n/)) {
    const m = line.match(/^\|\s*(R-\d+)\s*\|/);
    if (!m) continue;
    const cells = line.split("|").map((c) => c.trim());
    // | ID | Category | Description | Likelihood | Impact | Mitigation | Status |
    const mitigation = cells[6] ?? "";
    if (!mitigation) {
      findings.push(`risk-register.md: ${m[1]} has no mitigation`);
    }
  }
}

// ---- 5: design declares scope / component paths -----------------------------
const design = read(join(dir, "design.md"));
if (design === null) {
  findings.push("design.md: missing — nothing declares component Scope/paths");
} else if (!/^##\s+(Scope|Component Paths)\s*$/im.test(design)) {
  findings.push("design.md: no '## Scope' or '## Component Paths' section — component paths undeclared");
}

// ---- report ------------------------------------------------------------------
if (findings.length === 0) {
  console.log("consistency-check: clean");
  process.exit(0);
}
console.log(`consistency-check: ${findings.length} finding(s)`);
for (const f of findings) console.log(`  ✖ ${f}`);
process.exit(1);
