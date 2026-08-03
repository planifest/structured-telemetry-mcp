# Design - 0000018-telemetry-data-integrity

## Feature
- Problem: Nothing the telemetry system reports about itself can currently be trusted — not that data survived a restart, not that a deploy shipped, not that a query returned everything. On 2026-08-03 the database became permanently unopenable with no backup and no restore point, `npm run deploy` reported success while serving a stale build, and the event log was measured dropping 26–45% of rows from its own pagination while reporting a correct total.
- Adoption mode: standard-iterative
- Feature ID: 0000018-telemetry-data-integrity
- Discovery: see `plan/current/discovery.md` (raw P0 findings — do not embed them here; this document records confirmed decisions only)
- Version: 0.13.0 → **0.14.0** (minor; Feature Pipeline track)
- Pipeline track: **Feature Pipeline** — 00024 introduces new backup infrastructure and four user stories exceeds the ≥3 threshold

## Product Layer
- User stories:
  - US-001: As an engineer deploying a fix, I want the deploy to fail loudly when the running daemon is not the build I just made, so that I never test against stale code believing it is current. *(00019)*
  - US-002: As an operator of the telemetry daemon, I want the database to survive an unclean shutdown, so that a crash, reboot, or deploy never strands or destroys collected events. *(00008)*
  - US-003: As an operator, I want verified, retained backups taken automatically, so that any future failure — predicted or not — has a restore path. *(00024)*
  - US-004: As an engineer reading the event log, I want every page to show a stable, complete slice of the results, so that paging through a log never silently hides events. *(00009)*
- Acceptance criteria confirmed: 11 (see `feature-brief.md`)
- Constraints:
  - DuckDB is single-writer (ADR-002); backups and checkpoints must not contend with the live daemon's lock — that contention produced the incident's crash loop
  - Supervision is launchd/systemd with `KeepAlive` (ADR-014); exit-code changes interact with automatic restart, and a fast-exit loop is itself an outage mode
  - The `product_id` ALTER (ADR-017) already exists in WALs in the wild — the fix must handle databases *already* poisoned, not only prevent new ones
  - ADR-016 establishes limit/offset bounding; the tiebreaker works within it rather than superseding it
- Integrations: `scripts/service-manager.mjs` → daemon `/health` (build-identity assertion, new); launchd/systemd → daemon process (graceful-shutdown signal handling, new)

## Architecture Layer
- Latency target: not constrained for this feature. Constraint instead on write path — the daily backup and its restore verification must not block ingestion (mechanism to be settled by the P2 backup-ownership ADR).
- Availability target: the daemon refuses to start only when the store is genuinely unusable; every lesser failure degrades and keeps serving. No restart loop under any failure condition (decision C).
- Scalability target: not constrained — single-user localhost deployment, ~4,100 events over 7 weeks observed.
- Security: no change in this feature. Loopback-only daemon, no auth — the known gaps (auth/Origin/Host, error leakage, body DoS) are deliberately a separate wave (backlog 00010–00014, 00020).
- Data privacy: no regulated data. Telemetry contains pipeline metadata, file paths, and error strings — local to the developer's machine. Retention: backups kept 7 daily + 4 weekly.
- Observability: `doctor` reports the age of the most recent *verified* backup, and "no verified backup" when none exists. Startup self-check emits an actionable operator message on WAL-replay failure. Failed backups and failed verifications warn rather than fail silently.
- Cost boundary: not constrained. Backup disk footprint ~15–20 MB at current database size.

## Engineering Layer
- Stack: frontend none (log viewer untouched, ADR-018) / backend TypeScript on Node ≥20.19.0 using `node:http` directly / database DuckDB `@duckdb/node-api` 1.5.1-r.2 (ADR-002) / ORM none / IaC none / cloud none / compute local process under launchd (macOS) and systemd (Linux) (ADR-014) / CI GitHub Actions / Build target local
- Components:
  - `structured-telemetry-mcp` (existing, single component) — MCP server plus HTTP daemon; owns the DuckDB telemetry store. All four features land here. No new components; the backup module is new surface *within* this component because it operates on data this component solely owns.
- Data ownership:
  - `~/.planifest/telemetry.db` (DuckDB) → `structured-telemetry-mcp`, sole writer, not shared
  - Backup artifacts (new; location to be settled at P1, with 00024 recommending a default *outside* `~/.planifest/` so a mistaken wipe of that directory does not take the backups with it) → `structured-telemetry-mcp`
- Deployment: single local daemon on port 3741, supervised. This feature changes the service definitions themselves (decision C).
- API versioning: not applicable. `/health` gains a build-identity field — additive, no breaking change.

## Scope
- In:
  - Graceful shutdown: `SIGTERM`/`SIGINT` handling, checkpoint, clean connection close
  - Periodic checkpoint every 60 seconds or 100 events, whichever first
  - WAL-safe migrations — `ADD COLUMN` must not serialise function-valued defaults into an unreplayable ALTER
  - **(D)** On an unopenable database: refuse to start, stay stopped, print an actionable message naming the file, the conflicting PID where applicable, and the recovery procedure; never delete, truncate, or modify the WAL
  - **(C)** Supervision configuration changes — launchd plist and systemd unit — because "refuse to start" is unachievable from the daemon's exit code alone
  - Daemon `uncaughtException` failure posture, distinguishing "refuse to start" from "runtime error while serving"
  - Scheduled daily backup, retained 7 daily + 4 weekly, with restore verification on every backup, ordered strictly **verify → promote → prune**
  - Backup staleness surfaced via `doctor`
  - Documented restore procedure, explicitly linked as the recovery path from the startup self-check message
  - **(A)** Deploy asserts the running daemon's **build identity** (fingerprint), not merely its version string
  - **(B)** The deploy assertion enforced across all three platform paths, preferably lifted into `service-manager.mjs`
  - Deploy detects a foreign/orphaned port holder and refuses rather than reporting success, naming the orphan PID without killing it
  - Unique tiebreaker on every event-log ORDER BY, with a regression test asserting pagination completeness rather than markup
- Out:
  - HTTP boundary hardening — validation gaps, error leakage, auth/Origin/Host, body DoS, unbounded result sets, unbacked security-test claims (backlog 00010–00014, 00020). Needs its own ADR and P5 security review.
  - Log viewer correctness (backlog 00015–00018) and improvements (backlog 00021–00022)
  - Client-side buffering or retry for events emitted while the daemon is down
  - Migrating to keyset pagination (would supersede ADR-016; the tiebreaker does not)
- Deferred:
  - **Recovery of the ~4,100 stranded events (backlog 00023).** Exploratory work against an undocumented WAL binary format with uncertain success. Nothing in this feature is blocked by it; the data is safe in two checksum-verified copies. Blocks nothing.

## Assumptions
- Single-user, localhost deployment — impact if wrong: the single-writer and no-auth assumptions both break, and the backup-ownership design would need revisiting.
- `EXPORT DATABASE` is preferred over raw file copy because it survives DuckDB version changes — impact if wrong: backups could become unreadable by exactly the mechanism that caused the incident. To be confirmed at P2.
- Existing developer machines may already hold an unopenable database — impact if wrong: none; the handling is harmless if never triggered.
- `/health` has reported `version` since 0.12.0, so build-identity comparison is possible from day one — impact if wrong: the first deploy after upgrade cannot compare and must degrade to a warning rather than a false pass.

## Risks
- **An operator can still destroy the stranded data by hand** — likelihood medium, impact high. Decision D preserves the WAL by never touching it, but the obvious remedy for "database won't open" is to delete the `.wal`, which is irreversible. Auto-copy-aside was offered and not chosen. Mitigation is the wording of the startup message and restore docs. *Accepted residual risk.*
- **A poisoned machine gets neither a daemon nor backups until a human intervenes** — likelihood medium, impact medium. Accepted as the cost of not silently switching a user's dataset.
- **Backup ownership vs the single-writer lock is unresolved** — likelihood high, impact high if wrong. Independently flagged as the load-bearing unknown by three of four scope-lock subagents. An external scheduler cannot open the database while the daemon holds the lock — the exact conflict that produced the crash loop — which appears to force the backup in-process. Must be settled by ADR at P2 before P3.
- **Changing exit posture interacts with `KeepAlive`** — likelihood medium, impact high. Exiting zero does not stop a restart loop either; it only quietens it. Supervision config is in scope (C) precisely to close this, and needs an ADR-014 amendment.
- **Events emitted during any daemon outage are lost, not queued** — likelihood high, impact low-medium. Out of scope; a cleaner refusal is better-signposted but not less lossy.
- **`doctor` may already be unable to read the database while the daemon is running** — likelihood medium, impact low. Pre-existing rather than introduced here, but it constrains how backup age is sourced. To confirm at P1.

## Dependencies
- Upstream: DuckDB `@duckdb/node-api` 1.5.1-r.2 (its WAL-replay behaviour is the root cause); launchd (macOS) and systemd (Linux) supervision semantics.
- Downstream: the Planifest framework's telemetry hooks emit into this daemon — a refuse-to-start posture means their emissions fail loudly rather than silently, and they already write durable failure markers.

## Active Skills
None. `planifest-framework/skills-inbox/` is empty and no capability skills are installed for this run. Assessed against the declared stack: the available capability skills (frontend-design, webapp-testing, mcp-builder, docx/pdf/xlsx) do not fit a Node daemon durability and backup feature — no UI, no document generation, and the MCP server already exists.

## Skill Map
| Requirement | Best-fit Skill | Rationale |
|-------------|----------------|-----------|
| US-001 — deploy build-identity verification (00019) | planifest-codegen-agent (TDD inner loop: test-writer → implementer → refactor) | Ordinary implementation across `service-manager.mjs` and three platform scripts; testable by deploying against a deliberately stale same-version daemon |
| US-002 — daemon durability (00008) | planifest-codegen-agent, then planifest-verify-by-execution | The acceptance criterion is behavioural under `kill -9` and cannot be proven by unit tests alone — it needs the software actually run, killed, and reopened |
| US-003 — scheduled backups (00024) | planifest-adr-agent (P2, backup ownership) then planifest-codegen-agent | Blocked on the single-writer ADR before implementation; the verify→promote→prune ordering is the correctness core |
| US-004 — deterministic pagination (00009) | planifest-codegen-agent | Small, well-understood fix; the value is in a regression test that pages a seeded set with duplicate sort keys and asserts exact set equality |
| Cross-cutting — security review | planifest-security-agent (P5) | Supervision config and a new backup artifact path are both security-relevant surfaces |

## Repo Instructions

From `planifest-overrides/instructions/`:

**`framework-update-policy.md`** — Uncommitted changes under `planifest-framework/` are a dependency update, not a feature: commit them directly with a plain message, staged separately from product code, never routed through the P0–P9 pipeline. Applied during this run — framework changes were committed separately at `0e37f04` before P0 began.

**`git-up-to-date-shorthand.md`** — "GUTD" means: `git status` first, checkout `main`, pull latest, and report any untracked files rather than silently ignoring them. Do not force-reconcile a diverged local `main`; investigate first and prefer a reversible step.

## Confirmation
Human confirmed this design before proceeding: yes // Date and Time confirmed: 03 Aug 2026 @ 03:21 AM BST

Also confirmed at this gate: version 0.13.0 → 0.14.0 (minor); adoption mode `standard-iterative`;
run mode `interactive` (confirm at every phase gate P1–P6).
