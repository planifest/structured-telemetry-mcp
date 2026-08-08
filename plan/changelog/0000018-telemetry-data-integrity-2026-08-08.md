# Changelog — 0000018-telemetry-data-integrity — 08 Aug 2026

**Feature:** Telemetry Data Integrity
**Pipeline run:** Phases P0–P9 completed. None skipped.
**PR:** {pending — updated after PR is raised in Step 10}

## What Was Built

On 2026-08-03 the production telemetry database became permanently unopenable, stranding roughly 4,100 events; in the same session, `npm run deploy` reported success while continuing to serve a stale build, and the event log measured dropping 26–45% of rows from its own pagination while reporting a correct total. This feature makes the telemetry record trustworthy again, across four user stories:

- **Daemon durability** — graceful-shutdown checkpoint (SIGTERM/SIGINT), periodic checkpoint (60s/100-write threshold), checkpoint-immediately-after-migration, and refuse-to-start (exiting cleanly) on a locked or unreplayable-WAL database — never touching the WAL itself, always naming the file, PID where applicable, and the recovery procedure.
- **Scheduled, verified backups** — a new in-process backup module using DuckDB's `EXPORT DATABASE`, strictly ordered verify → promote → prune, retained 7 daily + 4 weekly, defaulting to `~/.planifest-backups`. `npm run doctor` reports verified-backup staleness without ever opening the live database.
- **Deploy trust** — `GET /health` gains a build-content fingerprint so `npm run deploy` catches a stale running daemon even at an unchanged version string, plus detection of a foreign process already holding the daemon's port.
- **Pagination completeness** — a uniqueness tiebreaker on every event-log sort, closing the row-drop/duplication defect.

## Artifacts Produced

- Requirements: `execution-plan.md`, 10 requirement files (`req-001`–`req-010`), `scope.md`, `risk-register.md`, `domain-glossary.md`, `operational-model.md`, `slo-definitions.md`, `cost-model.md`
- Architecture: 4 ADRs (`ADR-028`–`ADR-031`)
- Implementation: `src/db/refuse-to-start.ts`, `src/db/checkpoint.ts`, `src/backup/backup-service.ts`, `src/backup/backup-metadata.ts` (new); `src/server-http.ts`, `src/cli.ts`, `src/query/event-log.ts`, `scripts/service-manager.mjs`, `scripts/deploy.ps1`, `scripts/service-macos.sh`, `scripts/service-linux.sh` (modified)
- Documentation: `src/structured-telemetry-mcp/docs/restore-procedure.md` (new), 8 other per-component docs updated in place, 4 living docs updated (`component-registry.md`, `architecture-overview.md`, `decisions-index.md`, `api-index.md`)
- Security: `security-report.md` (2 Medium findings, both fixed and verified same-day)
- `recommendations.md`; 2 backlog entries filed (`00026`, `00027`)

## Decisions

- **ADR-028** — Backups use `EXPORT DATABASE` (Parquet + `schema.sql`), not a raw file copy, because a raw copy is tied to the exact DuckDB version that wrote it — the precise fragility that caused the 2026-08-03 incident.
- **ADR-029** — The backup routine runs in-process on the daemon's own DuckDB connection, never a second connection to `telemetry.db` — eliminates the single-writer-lock conflict by construction.
- **ADR-030** — Refuse-to-start exits 0, deliberately: both `launchd` and `systemd`'s existing supervision configs already restart only on a non-zero exit, so this alone achieves "stay stopped," correcting a P0-time assumption that supervision config changes were required for this specific guarantee.
- **ADR-031** (amends ADR-014) — The originally-scoped supervision circuit-breaker config ships as defense-in-depth against unrelated crash loops, not as the primary mechanism.

## Skipped Phases

None.
