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
- **Decided (D):** on an unopenable database the daemon refuses to start and stays stopped, printing an actionable message naming the file, the conflicting PID where applicable, and the recovery procedure — and never deletes, truncates, or modifies the WAL (00008)
- **Decided (C):** supervision configuration changes — launchd plist and systemd unit (`KeepAlive`/`SuccessfulExit`, `ThrottleInterval`, or `Restart=on-failure` + `RestartSec`) — because "refuse to start" is not achievable from the daemon's exit code alone. Amends ADR-014 surface; needs an ADR at P2 (00008)
- Setting the daemon's `uncaughtException` failure posture, distinguishing "refuse to start" from "runtime error while serving" (00008) — requires an ADR at P2 resolving whether ADR-005's exit-zero principle extends from hooks to a supervised daemon
- Scheduled backup with retention and **restore verification**, ordered strictly **verify → promote → prune** (00024)
- Backup staleness surfaced via `doctor` (00024)
- Documented restore procedure, explicitly linked as the recovery path from the startup self-check message (00024)
- **Decided (A):** deploy asserts the running daemon's **build identity** (fingerprint — bundle hash or mtime), not merely its version string, so same-version redeploys are also caught (00019)
- **Decided (B):** the deploy assertion is enforced across **all three platform paths** — preferably lifted into `scripts/service-manager.mjs` after the shell script returns, rather than duplicated into `service-macos.sh`, `service-linux.sh` and `service.ps1` (00019)
- Deploy detects a foreign/orphaned port holder and refuses rather than reporting success, naming the orphan PID and the command to stop it — without killing it itself (00019)
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
| Deploy correctness | **100% detection of a running daemon whose build artifact differs from the one just built** — including same-version redeploys (decision A). Version equality alone is insufficient. | Deploy against a deliberately stale daemon at the *same* version; assert non-zero exit and a message naming both identities |

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

### Accepted residual risks

- **An operator can still destroy the stranded data by hand.** Decision D preserves the WAL by having the daemon never touch it, but the obvious and widely-suggested remedy for "database won't open" is to delete the `.wal` — precisely what would have permanently destroyed seven weeks of events on 2026-08-03. The auto-copy-aside variant was considered and not chosen. The safeguard is therefore the wording of the startup message and the restore documentation, both of which must state plainly that deleting the WAL is irreversible. Carry into the P1 risk register.
- **A poisoned machine gets neither a daemon nor backups until a human intervenes.** Because the daemon refuses to start (D), the new backup routine never runs on exactly the machines most in need of one. Accepted as the cost of not switching a user's dataset silently.
- **Events emitted while the daemon is down are lost, not queued.** Client-side buffering/retry is out of scope; the 13 dropped emissions in `backlog-pickup/00008-.../evidence/` are the shape of what still happens. A cleaner refusal makes outages better-signposted, not less lossy.

## Scenario Paths

> Completed via the Scope Lock Challenge, 2026-08-03. Each answer was drafted by a fresh-context
> `planifest-scope-lock-agent` subagent, then amended by human decisions A–D (recorded in
> `build-log.md`) and confirmed. Source labels are in the build log.

**Happy path:** An engineer runs `npm run deploy`. The build completes; the running daemon takes
`SIGTERM`, checkpoints DuckDB and closes cleanly, so `telemetry.db` is self-contained and the WAL is
drained at exit. launchd bootstraps the new instance, and deploy no longer trusts an HTTP 200 alone —
it compares the daemon's reported **build identity** (fingerprint, not just version) against the
artifact it just built, confirms `launchctl list` reports a live PID, and prints a line naming both.
Overnight the daily backup runs: checkpoint, write a timestamped `EXPORT DATABASE` artifact, restore it
into a scratch location, assert the row count pinned at export time, discard the scratch copy, then
prune to 7 daily + 4 weekly. `npm run doctor` reports the age of the most recent *verified* backup.
Events keep arriving, and paging the event log returns every row exactly once, reconciling against
`total_count`. Success is four positive signals the engineer can read directly — a build identity, a
live PID, a verified-backup age, and a page count that reconciles — not merely the absence of an error.

**First-run path:** On a new machine the database does not exist: the schema is created, no migration
runs, and the checkpoint cycle begins immediately; a `SIGTERM` a minute later checkpoints and exits
cleanly. On a machine whose database is **already in the poisoned-WAL state**, the first start after
upgrading refuses to start, names `~/.planifest/telemetry.db.wal`, states that it cannot be replayed,
points at the documented restore procedure, and **does not delete, truncate, or otherwise modify the
WAL** — the stranded data stays recoverable. The first ever backup creates its directory (absence is
normal, not an error), writes one artifact, has nothing to prune, and its verification asserts both
that the `events` table is present and that the row count matches the count pinned at export time —
including when that count is zero. Until a verified backup exists, `doctor` reports "no verified
backup" rather than an age. The first deploy after the check lands can compare build identity from day
one. An empty log returns zero rows with `total_count` 0; the pagination tiebreaker changes nothing
visible below one page.

**Error / sad path:** The most likely failure is the daemon finding the store unusable — either another
process holds the DuckDB single-writer lock, or the WAL cannot be replayed. Both occurred on
2026-08-03, and both recur whenever `npm start` is run alongside the installed service, so this is the
routine case rather than the exotic one. There the daemon **refuses to start and stays stopped** —
achieved via both its own exit behaviour and the supervision configuration (in scope per decision C) —
printing one message naming the database file, the conflicting PID where there is one, and the
recovery step, rather than looping and burying the cause. Everything short of "the store is unusable"
**degrades and keeps serving**: a checkpoint failing on a full disk or momentary contention logs a
warning and retries at the next interval, because refusing there would convert a transient blip into an
outage that loses more events than the failure itself. A failed backup, or a fresh backup whose
verification does not match, is a warning and never a hard failure — ingestion continues, the artifact
is not counted as verified, and `doctor`'s staleness warning escalates on its own. If free space is
below the floor after pruning, the next backup is skipped with a loud warning: the live database's
headroom outranks one more copy. A deploy that finds a build-identity mismatch, or a port held by a
process launchd does not own, exits non-zero and names the cause and the orphan PID with the command to
stop it — it does not kill the foreign process itself. An unclean `kill -9` is deliberately not an
error path: up to the agreed 60-second window is lost, the database reopens cleanly, and nothing is
reported.

**Cross-session continuity:** The state at risk is the events collected since the last checkpoint, plus
the integrity of the backup set itself. On an unclean stop the database reopens with everything up to
the most recent checkpoint, so at most the agreed 60-second / 100-event window is lost and no
hand-repair is ever required. A backup becomes visible as a backup only once it is complete **and**
verified: written under a temporary name, restored and row-counted, and only then renamed into the
retained set — so an interrupted backup leaves a discardable partial that nothing can mistake for a
good one. Retention pruning runs strictly after that promotion (**verify → promote → prune**) and
considers only already-verified artifacts, so an interrupted or failed run can never remove an older
good backup; the worst outcome is one extra file on disk, never zero backups. The policy must tolerate
the set momentarily holding N+1 rather than pre-pruning to make room. If the machine reboots between a
checkpoint and a scheduled backup, the previous verified backup remains the newest good one and
`doctor` reports its age, so staleness is visible rather than silent. If a deploy is interrupted
between stopping the old daemon and starting the new one, supervision restarts the daemon and the old
one checkpoints on its way down; re-running deploy names the mismatch rather than assuming success. In
every case recovery is re-running the same command — start, backup, or deploy — with no manual file
surgery.

## Acceptance Criteria

> Confirmed at P0 after the Scope Lock Challenge and decisions A–D.

- [ ] An unclean `kill -9` under sustained write loses no more than 60 seconds / 100 events, and the database reopens cleanly afterwards
- [ ] A database already in the poisoned-WAL state causes the daemon to refuse to start and **stay stopped** — no restart loop — printing one message naming the file, the conflicting PID where applicable, and the recovery procedure
- [ ] The WAL is left byte-identical after a failed start: not deleted, truncated, or modified
- [ ] `ADD COLUMN` migrations no longer serialise function-valued defaults into a WAL entry that cannot be replayed
- [ ] A scheduled backup runs daily, is retained 7 daily + 4 weekly, and every backup is verified by restoring it and asserting the row count pinned at export time
- [ ] Backup ordering is **verify → promote → prune**: a failed or interrupted backup never removes an older good backup, and never leaves a partial artifact that can be mistaken for a verified one
- [ ] `doctor` reports the age of the most recent *verified* backup, and "no verified backup" when none exists
- [ ] `npm run deploy` exits non-zero and names both identities when the running daemon's **build artifact** differs from the one just built — **including when the version string is identical**
- [ ] The deploy assertion holds on all three platform paths (macOS, Linux, Windows), not only the one exercised locally
- [ ] `npm run deploy` refuses to report success when the port is held by a process launchd does not own, naming the orphan PID and the command to stop it
- [ ] Paging through a full result set returns every row exactly once, for every sortable field and both sort directions
