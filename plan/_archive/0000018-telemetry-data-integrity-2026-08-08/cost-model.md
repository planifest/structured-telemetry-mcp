# Cost Model - Telemetry Data Integrity

**Skill:** [spec-agent](../skills/spec-agent-SKILL.md)
**Feature:** 0000018-telemetry-data-integrity
**Version:** 0.14.0

> No cloud spend — local process, local disk, no third-party services (design.md Architecture Layer: "Cost boundary: not constrained... Backup disk footprint ~15–20 MB at current database size"). The only real cost this feature introduces is local disk space for retained backups.

## Summary

| Category | Estimated Monthly Cost | Notes |
|----------|----------------------|-------|
| Compute | $0 | Local process under existing launchd/systemd/nssm supervision — no new compute resource |
| Storage | $0 (local disk) | ~15–20 MB for 7 daily + 4 weekly backup artifacts at current database size (~seven weeks of telemetry observed pre-incident) |
| Network / Egress | $0 | No network egress — loopback-only daemon, backups stay on local disk |
| Third-party Services | $0 | None introduced |
| **Total** | **$0** | This feature has no recurring monetary cost |

## Compute Costs

Not applicable. No new compute resource is provisioned — the backup routine and durability changes run inside the existing local daemon process (pending the P2 ADR on whether backup triggering is in-process or an external local scheduler, neither of which is a billed compute resource).

## Storage Costs

| Store | Service | Capacity | Unit Cost | Monthly Cost | Growth Rate |
|-------|---------|----------|-----------|-------------|------------|
| Backup artifacts (new, req-006) | Local disk | ~15–20 MB at current DB size, capped by 7 daily + 4 weekly retention (does not grow unbounded) | $0 (local disk, no cloud storage service) | $0 | Bounded — retention policy prunes older artifacts, so steady-state footprint tracks the live database's size, not cumulative history |

## Network / Egress Costs

Not applicable — loopback-only (`127.0.0.1`), no network egress of any kind.

## Third-party Services

None. `EXPORT DATABASE` (assumption A-002) is a built-in DuckDB capability, not a third-party service.

## Assumptions

1. The operator's machine has at least ~20 MB of free disk space available for the backup set — a reasonable assumption for any development machine capable of running the existing daemon at all; not independently verified by this feature (the backup routine's own low-disk handling, per design.md's error/sad path, skips the backup with a warning rather than failing the live database's write path).
2. No pricing tier or commitment applies — this is entirely local, uninstalled-from-any-cloud-account software.
