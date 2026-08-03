---
title: "Feature Brief - Telemetry Data Integrity"
summary: "The business case, scope, and product requirements for the feature."
status: "draft"
version: "0.14.0"
---
# Feature Brief - Telemetry Data Integrity

**Feature ID:** 0000018-telemetry-data-integrity

> Derived at P0 from four backlog entries picked up on 2026-08-03 (00019, 00008, 00024, 00009),
> rather than authored from scratch. Origin: a post-0.13.0 assessment plus a live data-loss incident.
> Source entries are reproduced in full in `plan/current/backlog-pickup/`.

## Business Goal

On 2026-08-03 the production telemetry database became permanently unopenable, stranding roughly 4,100
events spanning seven weeks. There was no backup, no restore point, and no warning — the database had
in fact been un-restartable since the day `product_id` shipped, surviving only because the process
never restarted. In the same session, `npm run deploy` reported complete success while continuing to
serve a build from hours earlier, and the event log was measured dropping 26–45% of rows from its own
pagination while reporting a correct total.

The through-line is that **nothing the telemetry system reports about itself can currently be trusted**:
not that data survived, not that a fix is running, not that a query returned everything. This feature
makes the telemetry record trustworthy — data survives an unclean shutdown, a deploy that says it
shipped has shipped, and a query that says it returned everything did.

## Features

| Feature | User Stories | Priority | Wave |
|---------|-------------|----------|------|
| Deploy version verification (00019) | As an engineer deploying a fix, I want the deploy to fail loudly when the running daemon is not the build I just made, so that I never test against stale code believing it is current. | must-have | 1 |
| Daemon durability (00008) | As an operator of the telemetry daemon, I want the database to survive an unclean shutdown, so that a crash, reboot, or deploy never strands or destroys collected events. | must-have | 1 |
| Scheduled database backups (00024) | As an operator, I want verified, retained backups taken automatically, so that any future failure — predicted or not — has a restore path. | must-have | 1 |
| Deterministic pagination (00009) | As an engineer reading the event log, I want every page to show a stable, complete slice of the results, so that paging through a log never silently hides events. | must-have | 1 |

Four features, one user story each — within the decomposition rule. No wave split needed (threshold is
5–6 features).

## Waves

| Wave | Features Included | Ships When |
|------|-------------------|------------|
| 1 | All four, in order: 00019 → 00008 → 00024 → 00009 | All acceptance criteria met; single release |

Sequencing rationale: 00019 first because until deploy is trustworthy, no other fix in this wave can be
verified as actually running. 00024 after 00008 because a backup taken without a prior checkpoint would
copy a database whose recent data lives in a WAL that may not replay — reproducing the exact failure it
exists to prevent. 00009 is independent of the other three and may proceed in parallel.

## Target Architecture

### Components

| Component | Type | New or Existing | Responsibility |
|-----------|------|-----------------|---------------|
| structured-telemetry-mcp | service | existing | MCP server + HTTP daemon; owns the DuckDB telemetry store. All four features land here. |

No new components. 00024 adds a new backup module *within* the existing component rather than a
separate one, since it operates on data that component solely owns.

### Data Ownership

| Data Store | Owner Component | Shared With |
|------------|----------------|-------------|
| `~/.planifest/telemetry.db` (DuckDB) | structured-telemetry-mcp | none — sole writer |
| Backup artifacts (new, location TBC at P1) | structured-telemetry-mcp | none |

### Integration Points

| From | To | Method | Contract |
|------|-----|--------|----------|
| `scripts/service-manager.mjs` | daemon `/health` | HTTP GET | Deploy reads reported `version` and compares against `package.json` (new assertion) |
| launchd / systemd | daemon process | process supervision | Existing per ADR-014; graceful-shutdown signal handling is new |

## Stack

Established project — stack is inherited, not chosen here.

| Concern | Decision |
|---------|----------|
| Language | TypeScript |
| Runtime | Node (>= 20.19.0) |
| Framework | none — `node:http` directly |
| Frontend | none in this feature (vanilla JS log viewer untouched, per ADR-018) |
| Database | DuckDB (`@duckdb/node-api` 1.5.1-r.2) — ADR-002 |
| ORM | none |
| Testing | Vitest (unit/integration), Playwright (e2e) |
| IaC | none |
| Cloud | none — local daemon |
| Compute | local process under launchd (macOS) / systemd (Linux) — ADR-014 |
| CI | GitHub Actions |
| Build target | local |

## Scope Boundaries

### In Scope
- Graceful shutdown: `SIGTERM`/`SIGINT` handling, checkpoint, clean connection close (00008)
- Periodic checkpoint bounding the data-at-risk window (00008)
- WAL-safe migrations — `ADD COLUMN` must not serialise function-valued defaults into a replayable ALTER (00008)
- Reconsidering `uncaughtException → process.exit(1)` as the daemon's failure posture (00008)
- Startup self-check with an actionable message on WAL-replay failure (00008)
- Scheduled backup with retention and **restore verification** (00024)
- Backup staleness surfaced via `doctor` (00024)
- Documented restore procedure (00024)
- Deploy asserts the running daemon's version matches the build (00019)
- Deploy detects a foreign/orphaned port holder and refuses rather than reporting success (00019)
- Unique tiebreaker on every event-log ORDER BY (00009)
- Regression test asserting pagination completeness, not markup (00009)

### Out of Scope
- HTTP boundary hardening — validation gaps, error leakage, auth/Origin/Host, body DoS, unbounded result sets, and the unbacked security-test claims (backlog 00010–00014, 00020). Deliberately a separate wave: it needs its own ADR and a P5 security review.
- Log viewer correctness — async races, tail mode, state sync, keyboard access (backlog 00015–00018)
- Log viewer improvements — detail column, aggregate views (backlog 00021–00022)
- Client-side buffering or retry for events that cannot be delivered while the daemon is down (surfaced by the incident evidence; not yet filed as its own entry)
- Migrating away from limit/offset to keyset pagination (would supersede ADR-016; the tiebreaker fix does not)

### Deferred
- **Recovery of the ~4,100 stranded events (backlog 00023).** Explicitly deferred by the human on 2026-08-03. Exploratory work against an undocumented WAL binary format with an uncertain success rate; folding it in risks derailing a wave whose other four items are well understood. Nothing in this feature is blocked by it. The data is safe in two checksum-verified copies meanwhile.

## Non-Functional Requirements

> Confirmed by the human on 2026-08-03 during P0 coaching.

| NFR | Target | Measurement |
|-----|--------|-------------|
| Data-at-risk window | Checkpoint every **60 seconds or 100 events, whichever comes first**, plus a checkpoint on graceful shutdown. Max loss on an unclean kill: ~60s of events. | `kill -9` under sustained write; count events present after reopen; assert loss ≤ the window |
| Backup frequency | **Daily** | Scheduler config |
| Backup retention | **7 daily + 4 weekly** (~1 month, ~15–20 MB at current DB size) | Retention prune test asserts old backups are removed and the policy count holds |
| Restore verification | **On every backup**, immediately: restore into a scratch location, open it, assert expected row count, discard | Automated as part of the backup routine; a failed verification is surfaced, not swallowed |
| Pagination completeness | 0 dropped and 0 duplicated rows across a full pagination of the result set, for every sortable field and both directions | Seed rows with duplicate sort keys; page through; assert union equals source set exactly |
| Deploy correctness | 100% detection of a version mismatch between running daemon and built artifact | Deploy against a deliberately stale daemon; assert non-zero exit |

## Constraints and Assumptions

### Constraints
- DuckDB is single-writer (ADR-002). Backups and checkpoints must not contend with the live daemon's lock — this is what caused the crash loop during the incident.
- Supervision is launchd/systemd with `KeepAlive` (ADR-014). Any change to exit behaviour interacts with automatic restart, and a fast-exit loop is itself an outage mode.
- The `product_id` ALTER (ADR-017) is already present in existing WALs in the wild. A fix must handle databases that are *already* in the poisoned state, not only prevent new ones.
- ADR-016 establishes limit/offset bounding; the tiebreaker fix works within it rather than superseding it.

### Assumptions
- Single-user, localhost deployment — no multi-writer or clustered scenario to design for.
- Existing developer machines may already hold an unopenable database; the startup self-check should assume this is possible rather than exceptional.
- `EXPORT DATABASE` is preferred over raw file copy for backups because it survives DuckDB version changes — which is the exact class of failure that caused the incident. To be confirmed at P2.

## Scenario Paths

> To be completed during the Scope Lock Challenge.

**Happy path:** {{TBC}}

**First-run path:** {{TBC}}

**Error / sad path:** {{TBC}}

**Cross-session continuity:** {{TBC}}

## Acceptance Criteria

> Draft — to be firmed up once NFR targets are set.

- [ ] An unclean `kill -9` of the daemon under sustained write loses no more than the agreed data-at-risk window, and the database reopens cleanly afterwards
- [ ] A database already in the poisoned-WAL state produces an actionable operator message naming the file and the recovery procedure, rather than a raw DuckDB assertion and a crash loop
- [ ] `ADD COLUMN` migrations no longer serialise function-valued defaults into a WAL entry that cannot be replayed
- [ ] A scheduled backup runs, is retained per policy, and a restore of the newest backup is automatically verified by row count
- [ ] `doctor` reports backup age and warns past the agreed threshold
- [ ] `npm run deploy` exits non-zero and names the cause when the running daemon's version does not match the built artifact
- [ ] `npm run deploy` refuses to report success when the port is held by a process launchd does not own
- [ ] Paging through a full result set returns every row exactly once, for every sortable field and both sort directions
