---
title: "ADR 029: Backup Triggered In-Process, Not by an External Scheduler"
summary: "The daily backup runs on a timer inside the daemon process, using its own already-open DuckDB connection for EXPORT DATABASE — not an external cron/launchd-timer/systemd-timer process opening telemetry.db independently, which would reproduce the exact single-writer-lock conflict that caused the 2026-08-03 incident."
status: "accepted"
version: "0.1.0"
---
# ADR-029 - Backup Triggered In-Process, Not by an External Scheduler

**Skill:** [adr-agent](../skills/adr-agent-SKILL.md)
**Feature:** 0000018-telemetry-data-integrity
**Component:** structured-telemetry-mcp
**Date:** 2026-08-08

## Context

req-006 needs something to trigger the daily backup. DuckDB (ADR-002) is single-writer: only one process may hold an open connection to `telemetry.db` at a time. This was independently flagged as the load-bearing unknown by three of four Scope Lock subagents at P0 (design.md Risks; risk-register.md R-001; execution-plan.md Q-001), and the incident itself was a crash loop produced by exactly this kind of contention.

Two triggering mechanisms were considered: an external scheduler (cron, a launchd `StartCalendarInterval` job, or a systemd timer unit) running a standalone script that opens `telemetry.db` on its own schedule; or an in-process timer inside the already-running daemon, reusing the daemon's single open connection.

An external scheduler would need to open its own connection to `telemetry.db` to run `EXPORT DATABASE` against it. If the daemon is running (the normal case), that connection attempt collides with the daemon's own open connection — the single-writer lock conflict this feature exists to eliminate, not reproduce. If the daemon is *not* running, an external scheduler's backup would succeed, but that is also the exact scenario req-004 (decision D) deliberately leaves without a running daemon at all — a machine already refusing to start gets no backups until a human intervenes (risk-register.md R-004, already an accepted risk) regardless of which triggering mechanism is chosen.

## Decision

The backup routine is triggered by an in-process timer inside the daemon (`src/server-http.ts`, alongside req-002's periodic-checkpoint timer), using the daemon's own already-open DuckDB connection to run `EXPORT DATABASE`. No external scheduler process is introduced.

The scratch-restore verification step (req-006) opens a *separate* DuckDB instance against the exported artifact directory — not `telemetry.db` — so it does not contend with the daemon's own connection either.

**Backup artifact location:** a new environment variable `PLANIFEST_TELEMETRY_BACKUP_DIR`, defaulting to `~/.planifest-backups` (a sibling of, not nested inside, `~/.planifest/` — per backlog 00024's recommendation that a mistaken wipe of `~/.planifest/` must not also destroy the backups). When `PLANIFEST_TELEMETRY_DB` is overridden to a non-default path, `PLANIFEST_TELEMETRY_BACKUP_DIR` still independently defaults to `~/.planifest-backups` unless also explicitly overridden — the two are not derived from each other, keeping the "outside the primary data directory" property robust to either override alone.

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|-------------|
| External scheduler (cron / launchd Calendar / systemd timer) opening its own connection | Decouples backup timing from daemon uptime; backup could in principle run even if the daemon crashes (though req-004 means a genuinely broken daemon won't be running anyway) | Opens a second connection to `telemetry.db` while the daemon likely holds it — the precise conflict class that produced the incident's crash loop | Reproduces the root cause this feature exists to eliminate |
| In-process timer, daemon's own connection (chosen) | No second connection to `telemetry.db` ever exists; reuses req-002's proven timer pattern; backup naturally only runs when the daemon (and therefore the database) is healthy | Backup does not run at all while the daemon is down (including while refusing to start per req-004) | Already an accepted risk (R-004) independent of this choice — the daemon-down case has no backup either way; the in-process approach adds no new exposure and removes the lock-conflict risk entirely |

## Affected Components

| Component | Impact |
|-----------|--------|
| structured-telemetry-mcp | Owns the backup timer, the `EXPORT DATABASE` call, and the new `~/.planifest-backups` directory (or `PLANIFEST_TELEMETRY_BACKUP_DIR` override) — no other component ever writes here (Hard Limit 4: data owned by one component) |

## Consequences

**Positive:**
- Eliminates the single-writer-lock conflict for backups by construction — there is only ever one open connection to `telemetry.db`, the daemon's own.
- Reuses the same timer/scheduling pattern already established by req-002, keeping the daemon's lifecycle code cohesive rather than split across an in-process module and a separate OS-scheduled script.

**Negative:**
- No backup runs while the daemon is down, including the specific case where it is refusing to start due to a poisoned database (already an accepted risk, R-004, independent of this decision).
- Backup timing is coupled to daemon uptime and restart cycles — a daemon restarted shortly before its scheduled backup time could see the backup delayed until the next cycle after restart, depending on how the in-process timer is seeded on startup (implementation detail for P3, not blocking this decision).

**Risks:**
- The backup's `EXPORT DATABASE` call runs on the same connection actively serving `POST /emit`/`POST /query` traffic — req-006 and req-002 must be implemented so a long-running export does not starve ingestion (e.g. by measuring export duration at P4 against the existing NFR budget); flagged for validate-agent attention, not resolved by this ADR alone.

## Related ADRs

- ADR-002-storage-engine-duckdb - depends-on (single-writer constraint is the entire reason for this decision)
- ADR-028-export-database-as-backup-format - related-to (this ADR decides *who* triggers the export; ADR-028 decided *what format* the export uses)

## Supersedes

None.

## Superseded By

None.
