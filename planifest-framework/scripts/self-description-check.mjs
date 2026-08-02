#!/usr/bin/env node
/**
 * self-description-check.mjs — repository self-description drift check
 * (req-005, feature 0000019).
 *
 * A repository invariant, not a per-feature check: verifies the README's
 * own structural claims against the filesystem, on every PR, regardless of
 * whether a feature is in flight. Deliberately NOT part of
 * consistency-check.mjs, which validates plan/current/ during a feature run
 * with design-critic exit-code semantics — see ADR-001 for why the two are
 * kept separate.
 *
 * Checks:
 *   1. Every path named in the README's repository-structure diagram
 *      (## Repository structure fenced block) exists on disk.
 *   2. Every top-level directory under planifest-framework/ has a
 *      corresponding row in the framework table (## The framework).
 *
 * Counts nothing (README's Count column was removed in req-001) — only
 * existence and coverage, which is what keeps this check stable.
 *
 * Usage: node self-description-check.mjs [repoRoot]   (default: cwd)
 * Exit codes: 0 = clean, 1 = findings (listed on stdout, one per divergence).
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.argv[2] ?? process.cwd();
const readmePath = join(repoRoot, "README.md");
const findings = [];

function fail(message) {
  console.error(`self-description-check: ${message}`);
  process.exit(1);
}

if (!existsSync(readmePath)) {
  fail(`no such file: ${readmePath}`);
}

const readme = readFileSync(readmePath, "utf-8");

// ---- 1: structure-diagram paths must exist --------------------------------

function extractStructureBlock(text) {
  const headingIdx = text.search(/^##\s+Repository structure\s*$/m);
  if (headingIdx === -1) return null;
  const rest = text.slice(headingIdx);
  const fenceStart = rest.indexOf("```");
  if (fenceStart === -1) return null;
  const afterFence = rest.slice(fenceStart + 3);
  const fenceEnd = afterFence.indexOf("```");
  if (fenceEnd === -1) return null;
  return afterFence.slice(0, fenceEnd);
}

const block = extractStructureBlock(readme);
if (block === null) {
  findings.push('"## Repository structure" fenced diagram not found — cannot verify structure paths');
} else {
  let currentRoot = "";
  for (const line of block.split("\n")) {
    const rootMatch = line.match(/^(?:├──|└──)\s+(\S+)/);
    const nestedMatch = line.match(/^│\s+(?:├──|└──)\s+(\S+)/);

    if (rootMatch) {
      currentRoot = rootMatch[1];
      checkPath(currentRoot);
    } else if (nestedMatch) {
      checkPath(currentRoot + nestedMatch[1]);
    }
    // Continuation/prose lines and bare "│" connectors carry no new path —
    // intentionally skipped, per the AC's scope of "path named in the diagram".
  }
}

function checkPath(relPath) {
  const clean = relPath.replace(/\/$/, "");
  const abs = join(repoRoot, clean);
  if (!existsSync(abs)) {
    findings.push(`structure diagram names "${relPath}", which does not exist at ${clean}`);
  }
}

// ---- 2: every planifest-framework/ folder has a table row -----------------

function extractFrameworkTable(text) {
  const headingIdx = text.search(/^##\s+The framework\s*$/m);
  if (headingIdx === -1) return null;
  const rest = text.slice(headingIdx);
  const next = rest.slice(1).search(/^##\s+/m);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

const tableSection = extractFrameworkTable(readme);
if (tableSection === null) {
  findings.push('"## The framework" table not found — cannot verify folder coverage');
} else {
  const documented = new Set(
    [...tableSection.matchAll(/\[([\w-]+)\/\]\(planifest-framework\/([\w-]+)\/\)/g)].map((m) => m[2]),
  );

  const frameworkDir = join(repoRoot, "planifest-framework");
  const actualDirs = existsSync(frameworkDir)
    ? readdirSync(frameworkDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    : [];

  for (const dir of actualDirs) {
    if (!documented.has(dir)) {
      findings.push(`planifest-framework/${dir}/ exists but has no row in the "## The framework" table`);
    }
  }
}

// ---- report -----------------------------------------------------------

if (findings.length > 0) {
  console.error("self-description-check: README drift detected\n");
  for (const f of findings) console.error(`  - ${f}`);
  console.error(`\n${findings.length} finding(s). Fix README.md to match the repository, or vice versa.`);
  process.exit(1);
}

console.log("self-description-check: README structure and folder coverage match the repository ✓");
process.exit(0);
