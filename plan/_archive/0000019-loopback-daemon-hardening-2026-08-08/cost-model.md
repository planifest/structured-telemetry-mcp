---
title: "Cost Model - 0000019-loopback-daemon-hardening"
summary: "Compute, storage, egress and third-party cost estimates."
---
# Cost Model - 0000019-loopback-daemon-hardening

## Summary

**Zero incremental monetary cost.** No cloud, no hosted service, no third-party dependency added.

| Dimension | Cost | Notes |
|---|---|---|
| Compute | None | Local daemon on the developer's own machine. `compute: local-daemon`, `cloud: none` |
| Storage | None incremental | No schema change, no new table, no new file. Backup retention (7 daily + 4 weekly) is unchanged from 0000018 |
| Egress | None | Bound to `127.0.0.1`; this feature actively narrows what the daemon will talk to |
| Third-party services | None | No new runtime dependency. The work is header checks, byte counting, zod tightening, and tests |
| CI | Marginal | Additional Vitest cases plus a Playwright XSS suite, inside the existing 5-minute budget (NFR-011). GitHub Actions on the existing platform matrix; no new runner class |

## Resource cost that is worth stating

Two changes shift local resource use, both downward:

- **Peak memory falls.** req-007 stops `failure_sequence` and `drill_down` materialising unbounded row sets including full `data` JSON, and req-004 caps request bodies at 4 MB. The current unbounded paths are the daemon's realistic OOM route.
- **Wasted work falls.** The boundary checks (req-001 to req-003) reject before body reading, so a refused request costs a few header comparisons rather than a buffered body and a parse.

The only upward pressure is a per-request UUID generation for correlation ids (req-006), which occurs on the error path only and is negligible.

## Cost of not doing this

Recorded because it is the actual justification and is not otherwise captured in a monetary table. The current unbounded-body path lets one malformed request terminate the daemon (`process.exit(1)` via `uncaughtException`). Every such exit is an unclean kill, which costs up to the full data-at-risk window — events since the last checkpoint, bounded to 60 seconds or 100 writes by 0000018. The repository already carries the concrete precedent: roughly 4,100 events stranded in an unreplayable WAL from the 2026-08-03 incident, tracked as backlog 00023 and still unrecovered.
