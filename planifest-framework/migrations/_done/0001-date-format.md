# Migration 0001 — Date Format Standardisation

**Target standard:** DD MMM YYYY for body text; YYYY-MM-DD for filename prefixes and machine-readable fields  
**Scope:** `plan/`, `docs/`, `planifest-framework/`  
**Safe to skip:** Yes — skipping leaves non-compliant dates in place; re-running is safe

---

## What This Migration Does

Scans all Markdown files in the scope directories for dates in document body text that do not match the DD MMM YYYY format. Presents each finding to the human with file path, line number, current value, and proposed correction. Applies confirmed changes. Skips declined ones. Reports a summary.

---

## Patterns to Detect

Dates in document body text matching any of:

| Pattern | Example | Correct form |
|---------|---------|-------------|
| `YYYY-MM-DD` in prose (not in frontmatter `date:` or filename) | `2026-05-02` | `02 May 2026` |
| `DD/MM/YYYY` | `02/05/2026` | `02 May 2026` |
| `MM/DD/YYYY` | `05/02/2026` | `02 May 2026` |
| `Month DD, YYYY` | `02 May 2026` | `02 May 2026` |
| `DD Month YYYY` with full month name | `02 May 2026` | `02 May 2026` (zero-pad day) |

---

## Exclusions

Do not flag:
- Lines matching frontmatter `date:` key — YYYY-MM-DD is correct there
- Filename references (e.g. `2026-05-02-changelog.md`) — YYYY-MM-DD is correct in filenames
- JSON field values
- ISO 8601 timestamps with time component (e.g. `2026-05-02T10:00:00Z`) — these are machine-readable
- Code blocks (fenced ``` or indented)
- Inline code spans

---

## Migrator Instructions

For each non-compliant date found:

1. Show: `File: {path}:{line} | Current: {value} | Proposed: {DD MMM YYYY}`
2. Ask: `Apply? (y/n/all/none)`
3. Apply confirmed changes
4. Report: `{n} corrections applied, {m} skipped`

Move this file to `planifest-framework/migrations/_done/0001-date-format.md` when complete or explicitly skipped by the human.
