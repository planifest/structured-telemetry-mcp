---
title: "Build Log - 0000018-telemetry-data-integrity"
summary: "Working telemetry file maintained by the orchestrator throughout the pipeline run."
---
# Build Log - 0000018-telemetry-data-integrity

> Created at P0. Appended by the orchestrator at each phase boundary. Survives session changes.

## Header

| Field | Value |
|-------|-------|
| Feature ID | `0000018-telemetry-data-integrity` |
| Pipeline start | `2026-08-03T02:00:58Z` |
| Tool | `claude-code` |
| Primary model | `claude-opus-5` |
| Cheaper model | `claude-sonnet-5` |

---

## Phase Log

### P0 — Assess & Coach

| Field | Value |
|-------|-------|
| Start | `2026-08-03T02:00:58Z` |
| Model tier | primary |
| Skills loaded | planifest-orchestrator |
| Agents spawned | `4 (pre-P0 assessment: frontend, backend, UX, test-coverage reviews)` |
| MCP calls | `~20 (context-mode sandbox + browser)` |
| Parallel task batches | `1` |
| Telemetry | emitted |
| Notes | See deviations and audit trail below. |

**Deviation — Start Action −1 (context reset):** not performed. Host has no programmatic
context-clear; the human on the loop was flagged per the Context Hygiene procedure and elected to
finish P0 first and clear afterwards. Recorded rather than silently skipped. Residual context from the
pre-P0 assessment session is therefore present during this P0.

**Origin of this feature:** it did not begin from a Feature Brief. A post-0.13.0 assessment of the log
viewer and telemetry daemon (4 parallel review subagents + live verification against the running
daemon) produced 17 backlog entries, filed 2026-08-03. Four were scoped into this feature by the human.

**Incident context:** during that assessment the production telemetry database became unopenable
(unreplayable WAL). Service was restored on a fresh DB; ~4,100 events were preserved but stranded. Two
of this feature's four entries (00008, 00024) are the direct remediation. Full detail in
`plan/backlog/00008-daemon-durability-unreplayable-wal/`.

**Telemetry:** the unified signal is active (`--structured-telemetry-mcp`, backend
`http://localhost:3741`). One failure marker was produced during the incident
(`context-pressure::TypeError::fetch-failed`, 13 occurrences, 01:12:03Z–01:20:11Z) while the daemon was
down. It was moved to `plan/backlog/00008-.../evidence/` as incident evidence rather than left in
`plan/.telemetry-failures/`; the root cause is understood (daemon outage) and resolved (daemon healthy,
v0.13.0). No unacknowledged marker exists at P0 start.

### P0 Audit Trail

```
P0 exchange — scope: Q: What should 0000018 scope be, given 17 filed backlog entries?
              A: Data integrity + deploy trust — 00019, 00008, 00009 (recommended option).
P0 exchange — scope: Q: Fold 00024 (scheduled DB backups) into 0000018 as well?
              A: Yes, include it.
P0 exchange — context reset: Q: Clear context before coaching, or proceed and note the deviation?
              A: Finish P0 first, clear afterwards.
P0 exchange — routing: Q: Feature Pipeline or Change Pipeline for four backlog entries?
              A: Feature Pipeline — 00024 is new infrastructure and 4 stories exceeds the >=3
                 threshold. Stated as a determination, not contested by the human.
P0 exchange — NFR data-at-risk: Q: How much telemetry may be lost on an unclean kill?
              A: Checkpoint every 60s or 100 events, whichever first, plus on graceful shutdown.
P0 exchange — NFR backup policy: Q: Backup cadence and retention?
              A: Daily; keep 7 daily + 4 weekly.
P0 exchange — NFR restore verification: Q: How often is a backup actually restored and verified?
              A: On every backup, immediately — restore to scratch, assert row count, discard.
```

### Scope Lock Challenge

All four drafted by fresh-context `planifest-scope-lock-agent` subagents on explicit human request
("draft all 4 as subagents"). Each subagent received the artifacts only — feature brief, discovery,
the four picked-up backlog entries, relevant source — never the coaching conversation. The agents
raised 24 flags; four were scope decisions escalated to the human (A–D below) and the rest were routed
to P1/P2. Every path was amended by those decisions, so all four are recorded as `agent-draft-edited`
rather than accepted verbatim.

```
Scope Lock — happy path: Deploy compares build identity (not just version) and a live PID; SIGTERM
  checkpoints before exit; nightly backup checkpoints, exports, restores to scratch, asserts row count,
  prunes; doctor reports verified-backup age; event log pages reconcile against total_count. Success is
  four readable positive signals, not the absence of an error. [source: agent-draft-edited]
Scope Lock — first-run: New machine creates schema and starts checkpointing. Already-poisoned machine
  refuses to start, names the WAL, points at the restore procedure, and leaves the WAL untouched. First
  backup creates its directory, has nothing to prune, asserts schema presence plus export-time row count
  including zero; doctor reports "no verified backup" until one exists. Empty log returns zero rows.
  [source: agent-draft-edited]
Scope Lock — error/sad path: Most likely failure is an unusable store (lock held, or unreplayable WAL) —
  routine, not exotic. Daemon refuses to start and stays stopped via both exit behaviour and supervision
  config. Everything short of that degrades and keeps serving: failed checkpoint warns and retries;
  failed backup or verification warns and never blocks ingestion; low disk skips the backup rather than
  the database. Deploy exits non-zero naming the orphan PID without killing it. kill -9 is deliberately
  not an error path. [source: agent-draft-edited]
Scope Lock — cross-session continuity: At risk are events since the last checkpoint plus backup-set
  integrity. Backups are written to a temp name, verified, then promoted by rename; pruning runs strictly
  after promotion and only over verified artifacts, so a failed run can never remove the last good backup
  and the set may momentarily hold N+1. Recovery is always re-running the same command — no manual file
  surgery. [source: agent-draft-edited]
```

**Scope decisions escalated from the flags** (each explicitly confirmed by the human):

```
Scope Lock — decision A (00019 build identity): Version equality misses same-version redeploys, which
  are most deploys during iterative work. NFR strengthened to build-artifact identity (hash/mtime).
  A: Add build identity. [source: human]
Scope Lock — decision B (00019 platform coverage): The false "Service is healthy" originates in
  verify_service() in scripts/service-macos.sh, not service-manager.mjs; three sibling paths exist.
  A: Enforce across all three platforms, preferably lifted into service-manager.mjs. [source: human]
Scope Lock — decision C (00008 supervision): "Refuse to start" is unachievable from the daemon's exit
  code alone — KeepAlive restarts regardless. A: launchd plist and systemd unit changes are in scope;
  ADR-014 amendment required at P2. [source: human]
Scope Lock — decision D (00008 poisoned DB): A: Stop, preserve the WAL untouched, print recovery steps.
  Auto-remediation and defensive auto-copy-aside were both offered and not chosen. [source: human]
Scope Lock — accepted residual risk (from D): the operator can still delete the WAL by hand, which is
  the obvious remedy and is irreversible. Mitigation is wording of the startup message and restore docs.
  Carried into the P1 risk register. [source: human]
```

**Flags routed onward rather than decided at P0:**

```
To P2 (ADR): who runs the backup given DuckDB's single-writer lock (in-daemon vs external scheduler) —
  independently flagged as the load-bearing unknown by three of the four subagents; ADR-005 exit-zero
  scope (hooks only, or extended to a supervised daemon).
To P1: restore-verification row-count semantics against a live growing table (must pin the count at
  export time); backup artifact location (00024 recommends outside ~/.planifest/); doctor staleness
  threshold value; first-backup timing on install; whether doctor can read the DB at all while the
  daemon holds the lock (may already be broken pre-existing); disposition of a failed verification;
  scratch-restore cleanup after interruption.
```

Scope Lock complete. All four scenario paths captured.

---

## Summary (filled at P7)

| Metric | Value |
|--------|-------|
| Total phases completed | `{{count}}` |
| Total agents spawned | `{{count}}` |
| Total MCP calls | `{{count}}` |
| Phases using parallelism | `{{count}}` |
| Primary tier agent calls | `{{count}}` |
| Cheaper tier agent calls | `{{count}}` |
| Self-corrections | `{{count}}` |
| Phases skipped | `{{list or "none"}}` |
| Phases with a recorded telemetry gap | `{{count — phases where Telemetry was failed-with-recorded-choice, or "0"}}` |
