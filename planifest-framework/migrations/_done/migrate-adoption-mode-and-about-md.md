---
title: "Migrate: Fix Adoption Mode in Archives + Init docs/about.md"
feature: "0000014-improve-adoption-mode-selection"
date: "2026-05-19"
resumable: true
progress_file: "planifest-framework/migrations/_progress/migrate-adoption-mode-and-about-md.json"
---

# Migration: Fix Adoption Mode in Archives + Init docs/about.md

This migration has two parts. Execute Part A first and fully, then execute Part B.

A progress file at `planifest-framework/migrations/_progress/migrate-adoption-mode-and-about-md.json` tracks completion so the migration can be resumed across sessions.

**Progress file schema:**
```json
{
  "part_a_complete": false,
  "part_b_complete": false,
  "last_file_processed": null,
  "version_confirmed": null
}
```

If the progress file exists and `part_a_complete` is true, skip Part A and go to Part B. If `part_b_complete` is true, the migration is fully complete — archive it.

---

## Part A — Fix Adoption Mode in Archived design.md Files

### Scope

Scan all files matching: `plan/_archive/**/design.md`

### What to find

In each file, find the line that matches:
```
Adoption mode: <value>
```

### What to correct

The valid adoption mode values are: `greenfield`, `standard-iterative`, `retrofit`, `external-anchor`

For each file where the value does not match one of the four valid values (e.g., `agent-interface`, `unknown`, blank), auto-detect the correct value using these signals from the same file and its surrounding archive directory:

| Signal | Inferred Mode |
|--------|--------------|
| `external-versioning.md` referenced in `## Repo Instructions` | `external-anchor` |
| Archive directory contains previous feature archives (i.e., this is not the first archive) | `standard-iterative` |
| Any `src/` discovery or retrofit notes in the design body | `retrofit` |
| No signals match | `greenfield` |

Present to the human one file at a time:
```
[File] plan/_archive/{path}/design.md
Current: Adoption mode: {current-value}
Detected signals: {list or "none"}
Proposed correction: Adoption mode: {inferred-value}

Apply? (yes / no / [manual value])
```

Apply only confirmed corrections. After each batch, update `last_file_processed` in the progress file.

### After Part A completes

Set `part_a_complete: true` in the progress file. Report: `Part A complete — {n} corrections applied, {m} skipped.`

---

## Part B — Initialise docs/about.md

### What to do

1. Check whether `docs/about.md` exists at the repository root.
   - If it exists and contains valid frontmatter with `version`, `feature`, and `updated` fields: report `docs/about.md` already initialised. Set `part_b_complete: true` and skip.

2. If absent (or present but missing required fields), determine the best version to initialise with:
   - Scan `plan/_archive/` for all archived `design.md` files. Extract any version references from the `## Version` or `version:` fields.
   - Find the most recent archived feature by directory name (alphabetical sort = chronological order).
   - Read `planifest-framework/component.yml` for the framework version as a cross-reference.
   - Present the suggested version to the human:
     ```
     P0: docs/about.md does not exist. Based on the archive history, the current version appears to be {version}.
     Initialise docs/about.md with version {version}? (yes / [alternative version])
     ```

3. After the human confirms:
   - Create `docs/` if it does not exist
   - Write `docs/about.md` using this exact format (do not include the template comment block):

     ```markdown
     ---
     version: "{confirmed-version}"
     feature: "{most-recent-feature-id-from-archive}"
     updated: "{today's date in DD MMM YYYY}"
     ---
     # About

     | Field | Value |
     |-------|-------|
     | Version | `{confirmed-version}` |
     | Last feature | `{most-recent-feature-id-from-archive}` |
     | Updated | `{today's date in DD MMM YYYY}` |
     ```

4. Set `part_b_complete: true` in the progress file. Set `version_confirmed` to the confirmed version.

Report: `Part B complete — docs/about.md initialised at version {version}.`

---

## Completion

When both parts are complete, the migrator archives this file to `planifest-framework/migrations/_done/` and deletes the progress file.
