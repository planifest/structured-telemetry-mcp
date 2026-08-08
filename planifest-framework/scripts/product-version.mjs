#!/usr/bin/env node
/**
 * product-version.mjs — derive the product release version from product.yml
 * per its versionPolicy (ADR-002, feature 0000016).
 *
 * Usage: node product-version.mjs [--root <projectRoot>]
 *
 * Exit codes:
 *   0 — version derived; printed to stdout
 *   2 — invalid manifest (bad semver, unknown versionPolicy, unreadable
 *       component path, missing/invalid version in a referenced
 *       component.yml); reason on stderr
 *   4 — no product.yml at root; caller falls back to single component.yml
 *   5 — versionPolicy is "external"; caller must consult the anchor/human
 *
 * No YAML dependency: parses the constrained shape of product.template.yml
 * (top-level scalars + a flat components list) line-by-line.
 *
 * `components[]` entries hold {id, path} — a pointer to that component's own
 * component.yml — not a cached version. Under versionPolicy
 * max-component-version, this script reads each referenced component.yml's
 * own `version:` field live at derivation time, so there is nothing in
 * product.yml itself to fall out of sync when a component bumps its version
 * mid-feature (revised 2026-08-08; see docs/decisions-index.md's Feature
 * 0000016 ADR-002 entry).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SEMVER_RE = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const POLICIES = ["max-component-version", "explicit", "external"];
const MAX_VERSION_LEN = 32;

function parseArgs(argv) {
  const i = argv.indexOf("--root");
  return { root: i >= 0 && argv[i + 1] ? argv[i + 1] : process.cwd() };
}

function unquote(v) {
  return v.trim().replace(/^["']|["']$/g, "");
}

function parseProductYml(text) {
  const doc = { version: null, versionPolicy: null, components: [] };
  let inComponents = false;
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trimEnd();
    if (!line.trim()) continue;
    if (/^components:\s*$/.test(line)) { inComponents = true; current = null; continue; }
    if (/^[A-Za-z]/.test(line)) inComponents = false;
    if (inComponents) {
      const idMatch = line.match(/^\s*-\s*id:\s*(.+)$/);
      if (idMatch) { current = { id: unquote(idMatch[1]), path: null }; doc.components.push(current); continue; }
      const pathMatch = line.match(/^\s*path:\s*(.+)$/);
      if (pathMatch && current) { current.path = unquote(pathMatch[1]); continue; }
    } else {
      const m = line.match(/^(version|versionPolicy):\s*(.+)$/);
      if (m) doc[m[1]] = unquote(m[2]);
    }
  }
  return doc;
}

function readComponentVersion(root, componentId, relPath) {
  const label = `component ${componentId ?? "(unnamed)"}`;
  if (!relPath) fail(2, `${label}: product.yml components[] entry has no path`);
  const abs = join(root, relPath);
  if (!existsSync(abs)) fail(2, `${label}: component.yml not found at ${relPath}`);
  const text = readFileSync(abs, "utf-8");
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.replace(/#.*$/, "").trimEnd().match(/^version:\s*(.+)$/);
    if (m) return unquote(m[1]);
  }
  fail(2, `${label}: no top-level version: field found in ${relPath}`);
}

function semverCompare(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

function fail(code, msg) {
  process.stderr.write(`product-version: ${msg}\n`);
  process.exit(code);
}

function validSemver(v, label) {
  if (typeof v !== "string" || v.length > MAX_VERSION_LEN || !SEMVER_RE.test(v)) {
    fail(2, `invalid version for ${label}: ${JSON.stringify(v)} (expected MAJOR.MINOR.PATCH)`);
  }
}

const { root } = parseArgs(process.argv.slice(2));
const manifestPath = join(root, "product.yml");

if (!existsSync(manifestPath)) {
  fail(4, `no product.yml at ${root} — fall back to single component.yml`);
}

const doc = parseProductYml(readFileSync(manifestPath, "utf-8"));

if (!POLICIES.includes(doc.versionPolicy)) {
  fail(2, `unknown versionPolicy: ${JSON.stringify(doc.versionPolicy)} (expected ${POLICIES.join(" | ")})`);
}

if (doc.versionPolicy === "external") {
  fail(5, "versionPolicy is external — consult the external anchor / human for the version");
}

if (doc.versionPolicy === "explicit") {
  validSemver(doc.version, "product (explicit policy)");
  process.stdout.write(doc.version);
  process.exit(0);
}

// max-component-version — read each referenced component.yml's version live
if (doc.components.length === 0) {
  fail(2, "versionPolicy max-component-version requires a non-empty components list");
}
let max = null;
for (const c of doc.components) {
  const v = readComponentVersion(root, c.id, c.path);
  validSemver(v, `component ${c.id ?? "(unnamed)"} (${c.path})`);
  if (max === null || semverCompare(v, max) > 0) max = v;
}
process.stdout.write(max);
process.exit(0);
