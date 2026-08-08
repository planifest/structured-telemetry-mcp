---
title: "Domain Glossary - Telemetry Data Integrity"
summary: "Definitions of domain terms used within this feature."
status: "active"
version: "0.14.0"
---
# Domain Glossary - Telemetry Data Integrity

**Skill:** [spec-agent](../skills/spec-agent-SKILL.md) (updated by any agent that introduces a new domain term)
**Feature:** 0000018-telemetry-data-integrity
**Version:** 0.14.0

> The ubiquitous language for this feature. If the glossary says "verified backup", the code says `verified`, not "confirmed" or "validated". Never invent new terms without adding them here.

## Terms

| Term | Definition | Aliases | Used In |
|------|-----------|---------|---------|
| Checkpoint | The act of flushing DuckDB's WAL into the main database file, shrinking the data-at-risk window. Triggered periodically (every 60s or 100 events, whichever first) and on graceful shutdown. | — | structured-telemetry-mcp |
| Data-at-risk window | The span of events written since the last checkpoint that would be lost on an unclean kill. Bounded to at most 60 seconds / 100 events by this feature. | — | structured-telemetry-mcp |
| Poisoned WAL | A write-ahead log file containing an entry (e.g. the `product_id` `ALTER` from ADR-017) that DuckDB's replay logic cannot process, making the database unopenable until the WAL is handled. Distinct from a merely *stale* WAL, which replays fine. | Unreplayable WAL | structured-telemetry-mcp |
| Refuse-to-start | The daemon's posture when it determines the store is unusable (poisoned WAL, or the lock held by another process): it does not attempt to start serving, does not modify the WAL, and exits in a way that supervision does not endlessly relaunch it against. The opposite posture is "degrade and keep serving". | — | structured-telemetry-mcp |
| Degrade and keep serving | The daemon's posture for every failure short of "the store is unusable" — a failed checkpoint, a failed backup, a failed verification — logs a warning and continues ingesting events rather than stopping. | — | structured-telemetry-mcp |
| Build identity | A fingerprint of the running daemon's build artifact (bundle content hash or file mtime) used by deploy to detect a stale process, as opposed to the daemon's self-reported semantic version string, which cannot distinguish two same-version builds. | Build fingerprint | structured-telemetry-mcp, scripts/service-manager.mjs |
| Orphan port holder | A process bound to the daemon's port (3741) that launchd/systemd did not start and does not own — e.g. a manually-run `npm start` left over from local development. Deploy must detect and name it rather than assuming its own daemon is what answered. | — | scripts/service-manager.mjs |
| Verified backup | A backup artifact that has completed the full verify→promote→prune cycle: restored into a scratch location, opened, and had its row count checked against the count pinned at export time. An artifact that has been written but not yet verified is not a verified backup and must not be reported as one. | — | structured-telemetry-mcp |
| Verify → promote → prune | The mandatory ordering for the backup routine: (1) write the export under a temporary name, (2) restore and row-count it in scratch to verify it, (3) rename it into the retained set only on success (promote), (4) only then prune older artifacts down to the retention policy. Guarantees a failed or interrupted run can never remove the last good backup. | — | structured-telemetry-mcp |
| Backup staleness | How long ago the most recent *verified* backup was taken, as reported by `doctor`. Distinct from "no verified backup exists at all", which is reported as its own state, not an infinite staleness value. | — | structured-telemetry-mcp, cli.ts |
| Scratch restore | A temporary, disposable restore of a backup artifact used only to verify it (row-count assertion), performed at a location distinct from the live database and discarded immediately after verification. | — | structured-telemetry-mcp |
| Pagination tiebreaker | An additional, always-unique column (e.g. `id`) appended to every event-log `ORDER BY` after the user-selected sort field, so that rows sharing the same sort-field value still resolve to one stable, total order across pages. | — | src/query/event-log.ts |
| Sidecar metadata file | A small JSON file written by the backup routine (not stored inside `telemetry.db`) recording the timestamp, row count, and verification status of the most recent verified backup. Read by `doctor` instead of opening the live database directly, avoiding the single-writer lock conflict documented in risk-register.md R-002. | — | structured-telemetry-mcp |
