---
title: "Requirement: req-006 - Scheduled, Verified Backup"
summary: "Detailed requirements for this specific functional feature."
status: "draft"
version: "0.1.0"
---
# Requirement: req-006 - Scheduled, Verified Backup

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000018-telemetry-data-integrity
**Source:** US-003
**Priority:** must-have

## User Story

As an operator, I want verified, retained backups taken automatically, so that any future failure — predicted or not — has a restore path.

## Functional Requirements

- **Blocked on P2 ADR (risk-register.md R-001):** who runs the backup — in-process (daemon triggers it on its own schedule) or an external scheduler (cron/launchd-timer/systemd-timer) — is unresolved pending the single-writer-lock ADR. This requirement specifies the backup *routine's* behaviour once triggered; the triggering mechanism itself is set by that ADR.
- Implement the backup routine as: (1) run `EXPORT DATABASE` to a timestamped directory under a temporary name (e.g. a `.tmp-` prefix or a staging subdirectory); (2) restore that export into a scratch location distinct from the live database; (3) open the scratch restore and assert its row count matches the row count pinned at the moment export began; (4) on success, rename (promote) the temporary export directory into the retained backup set using its final name; (5) discard the scratch restore; (6) only after promotion, prune the retained set down to 7 daily + 4 weekly, deleting only artifacts that are themselves already-verified (never the artifact just promoted, never a partial).
- If step (3)'s row-count assertion fails, or any step throws, the routine logs a warning, leaves the temporary export in place (or discards it — either is acceptable as long as it is never promoted), and does **not** proceed to promote or prune. The daemon's ingestion path is unaffected either way (backup failures never block writes).
- Pin the row count at the moment export *begins*, not after export completes, since the live table may continue growing during export — the scratch-restore assertion compares against that pinned count, not against the (possibly larger) live table's current count at verification time.
- Backup artifact location: outside `~/.planifest/` by default (per backlog 00024's recommendation, so a mistaken wipe of that directory does not take the backups with it) — confirm the exact default path with the human at P2 alongside the ownership ADR, since it interacts with the same discussion.
- Write a sidecar JSON metadata file recording the outcome of the most recent verified backup (timestamp, row count, artifact path) — this is what req-007's `doctor` command reads, so it never needs to open the live database itself. See data-contract.md's new Backup Artifacts section for the exact shape.

## Acceptance Criteria

- [ ] A scheduled backup completes the full verify → promote → prune sequence and the promoted artifact's row count matches the count pinned at export time
- [ ] A backup whose scratch-restore row count does not match the pinned count is never promoted into the retained set and never counted as verified
- [ ] An interrupted backup (simulated process kill mid-export) leaves the previously-promoted backup set completely intact — no older good backup is ever removed by a run that did not itself complete promotion
- [ ] Pruning only ever removes already-verified artifacts, never the artifact just promoted in the same run, and the set may momentarily hold 7 daily + 4 weekly + 1 rather than pre-pruning to make room
- [ ] The retention policy holds exactly 7 daily + 4 weekly artifacts after a prune, once enough backups have accumulated
- [ ] The very first backup on a fresh install creates its directory without error (absence is normal, not an error), has nothing to prune, and its verification asserts a row count of 0 correctly (not treated as a failure)
- [ ] A failed verification is surfaced as a warning (visible in logs / via req-007's `doctor` output) and never silently swallowed

## Dependencies

- Blocked on the P2 ADR (backup ownership vs. single-writer lock, risk-register.md R-001) for the triggering mechanism.
- Depends on req-002's checkpoint discipline — per design.md's Waves rationale, a backup taken without a prior checkpoint could copy a database whose recent data lives in a WAL that may not replay, reproducing the exact failure this feature exists to prevent. Sequence: req-002 must be functioning before req-006 is exercised in production.
- Feeds req-007 via the sidecar metadata file — req-007 cannot be implemented until this requirement's metadata-file shape is finalized.
- `EXPORT DATABASE`'s version-durability property is assumption A-002 (risk-register.md) — to be confirmed at P2.
