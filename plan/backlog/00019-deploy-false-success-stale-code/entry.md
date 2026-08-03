---
title: "Backlog Entry: 00019 - Deploy reports success while stale code keeps serving"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
severity: "high"
---
# Backlog Entry: 00019 - Deploy reports success while stale code keeps serving

**Source feature:** post-0.13.0 release review
**Source phase:** assessment (not a pipeline phase)

**Date filed:** 2026-08-03

**Scoped into:** 0000018-telemetry-data-integrity — **position 1 of 4**. Must land first: while deploy
can silently no-op, no other fix in this wave can be verified as actually running.

---

## Problem

`npm run deploy` printed a full success trace — `OK Build complete`, `OK Service stopped`,
`OK Service bootstrapped`, `OK Service is healthy` — while the daemon continued serving **v0.12.0**
from a build made hours earlier. Verified by `curl /health` returning `{"ok":true,"version":"0.12.0"}`
immediately after a clean deploy of 0.13.0.

Root cause chain:

1. A manually started daemon (`npm start`, later orphaned and reparented to init) held port 3741 and
   the DuckDB single-writer lock.
2. `service:restart` bootstrapped the launchd job. That instance crashed immediately —
   `IO Error: Could not set lock on file ".../telemetry.db": Conflicting lock is held ... (PID nnnnn)`
   -> `uncaughtException` -> `process.exit(1)` -> `KeepAlive` -> crash loop. `launchctl list` showed
   `LastExitStatus = 256` and **no PID**.
3. The restart script's health verification polled `/health`, got HTTP 200 **from the surviving
   orphan**, and declared the service healthy.

The health check verifies *that something answers on the port*, not *that the process it just started
is the one answering*. This is a false-positive liveness check, and it is precisely the gotcha the
deploy script's own header comment claims to close ("the running daemon has the old code loaded in
memory until reloaded").

The failure mode is silent and durable: a developer believes they are testing a fix that is not
running. During this review it caused an entire UI assessment to be aimed at the wrong build.

## Suggested Action

- **Compare versions, not liveness.** After restart, read `/health`'s `version` and assert it equals
  `package.json`'s version. Fail the deploy loudly on mismatch — this alone would have caught it.
- **Detect a foreign port holder.** Before bootstrapping, check whether port 3741 is held by a process
  launchd does not own (compare the `lsof` PID against `launchctl list`'s PID) and refuse to proceed
  with a clear message naming the orphan PID and how to stop it.
- **Surface the lock conflict.** The DuckDB lock error is the actual root cause and is already written
  to the error log; the restart script should tail and surface it rather than reporting success.
- **Verify the started instance.** Prefer checking that launchd reports a live PID for the job over
  probing the port.
- Consider having the daemon refuse to start (with a clear message) when the DB lock is already held,
  rather than crash-looping under `KeepAlive`.

## Why Deferred

Discovered during a post-0.13.0 assessment, not during a pipeline phase. This is tooling rather than
product code, but it undermines confidence in every other fix — a developer cannot verify any change
in this backlog while deploy can silently no-op. Recommend picking it up early, alongside
[[00008-daemon-durability-unreplayable-wal]], since both concern daemon lifecycle.
