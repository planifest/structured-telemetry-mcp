# Migration 0003 — Archive Directory Name Standardisation

**Target standard:** `plan/_archive/` (underscore prefix sorts to top alphabetically)
**Scope:** `plan/` directory at repo root
**Safe to skip:** Yes — skipping leaves `plan/archive/` in place; re-running is safe

---

## What This Migration Does

Checks whether `plan/archive/` exists in the repo root and renames it to `plan/_archive/` if so. Three cases:

1. `plan/archive/` exists and `plan/_archive/` does not → rename
2. `plan/_archive/` already exists and `plan/archive/` does not → already correct, no action
3. Both exist → warn the human and halt — do not merge or overwrite; ask for direction

---

## Migrator Instructions

1. Check for `plan/archive/` and `plan/_archive/` in the repo root.

2. **Case 1 — rename needed:**
   - Show: `plan/archive/ found. Will rename to plan/_archive/`
   - Ask: `Proceed? (y/n)`
   - If yes: rename the directory (or copy + delete if rename fails across drives)
   - Confirm: `Renamed plan/archive/ → plan/_archive/. Please verify the directory contents are intact.`
   - Ask: `Confirmed? (y/n)` — only proceed if human confirms

3. **Case 2 — already correct:**
   - Print: `plan/_archive/ already exists and plan/archive/ is absent — already correct. No changes needed.`

4. **Case 3 — both exist:**
   - Print: `WARNING: Both plan/archive/ and plan/_archive/ exist. Cannot merge automatically.`
   - Print: `Please resolve manually: decide which directory is authoritative, move its contents, and delete the other.`
   - Halt — do not proceed.

Move this file to `planifest-framework/migrations/_done/0003-archive-dirname.md` when the migration is complete or explicitly skipped by the human.
