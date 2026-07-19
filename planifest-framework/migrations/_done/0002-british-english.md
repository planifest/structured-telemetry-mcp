# Migration 0002 — British English Prose Correction

**Target standard:** British English spellings in all prose, labels, comments, and documentation  
**Scope:** `plan/`, `docs/` (planifest-framework/ prose is rewritten directly in P3)  
**Safe to skip:** Yes — skipping leaves American English spellings in place; re-running is safe

---

## What This Migration Does

Scans Markdown files in `plan/` and `docs/` for common American English spellings in prose. Presents each finding with file path, line number, current value, and proposed correction. Applies confirmed changes. Skips declined ones. Reports a summary.

Does NOT touch `planifest-framework/` — that directory is rewritten directly during P3 codegen.

---

## Common Substitutions

| American (detect) | British (propose) |
|-------------------|-------------------|
| artifact | artefact |
| artifacts | artefacts |
| analyze | analyse |
| analyzed | analysed |
| analyzing | analysing |
| behavior | behaviour |
| behaviors | behaviours |
| color | colour |
| colors | colours |
| customize | customise |
| customized | customised |
| customizing | customising |
| initialize | initialise |
| initialized | initialised |
| initializing | initialising |
| license (noun) | licence |
| maximize | maximise |
| minimize | minimise |
| organize | organise |
| organized | organised |
| organizing | organising |
| recognize | recognise |
| serialize | serialise |
| serialized | serialised |
| synchronize | synchronise |
| utilize | utilise |
| utilization | utilisation |

---

## Exclusions

Do not flag:
- Code blocks (fenced ``` or indented)
- Inline code spans (backtick-wrapped identifiers)
- File paths and URLs
- Variable names, function names, CSS properties, method names
- Lines that are clearly identifier definitions (e.g. `const color =`)
- YAML/JSON frontmatter values that are identifiers

When in doubt about whether a match is prose or code, present it to the human for manual review rather than auto-correcting.

---

## Migrator Instructions

For each match found:

1. Show: `File: {path}:{line} | Current: "{value}" | Proposed: "{british-value}"`
2. Ask: `Apply? (y/n/all/none)`
3. Apply confirmed changes
4. Report: `{n} corrections applied, {m} skipped`

Move this file to `planifest-framework/migrations/_done/0002-british-english.md` when complete or explicitly skipped by the human.
