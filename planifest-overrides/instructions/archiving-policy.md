# Archiving Policy

**All pipeline runs archive to `plan/_archive/{feature-id}-{YYYY-MM-DD}/` when they finish — no exceptions for route.**

The framework's default behavior only archives Feature Pipeline runs (via the ship-agent's P7 step); Change Pipeline runs (the change-agent) have no archiving step of their own and by default leave `plan/current/` as a permanent top-level `plan/{feature-id}/` folder. This override closes that gap.

## Rule

When a Change Pipeline run (change-agent) finishes Phase 5 (Documentation), before considering the change complete:

1. Determine the archive path: `plan/_archive/{feature-id}-{YYYY-MM-DD}/` (date = today, matching the ship-agent's own naming convention for consistency).
2. `git mv plan/current/` (or wherever the working folder currently is) to that path — never a plain copy+delete; preserve git history via rename detection.
3. Search the repo for cross-references to the old path (`docs/*.md`, `src/*/docs/*.md`, `plan/changelog/*.md`) before moving, and update every found reference to the new path in the same commit.
4. Commit the move and reference updates together.

This applies retroactively too: if you discover an existing `plan/{feature-id}/` folder from a prior Change Pipeline run that was never archived, normalize it the same way (with human confirmation before moving history around on a shared branch).

## Why

Established 2026-07-23 after `0000008`, `0000008c`, `0000009`, `0000011`, and `0000012` all ended up as permanent top-level `plan/` folders (Change Pipeline route) while `0000010` (Feature Pipeline route) was the only one properly archived — an inconsistent, confusing `plan/` layout with no single place to look for "is this feature done and filed away." Human explicitly requested normalizing this and keeping it consistent going forward, not just as a one-time cleanup.
