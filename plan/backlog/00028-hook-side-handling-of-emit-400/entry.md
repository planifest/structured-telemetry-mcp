---
title: "Backlog Entry: 00028 - Emission hooks may not treat a structured /emit 400 as a telemetry failure"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
severity: "medium"
---
# Backlog Entry: 00028 - Emission hooks may not treat a structured /emit 400 as a telemetry failure

**Source feature:** 0000019-loopback-daemon-hardening
**Source phase:** P0 (Scope Lock Challenge, error/sad-path agent flag b)

**Date filed:** 2026-08-08

---

## Problem

0000019 hardens the loopback daemon's request boundary. One consequence is that
`POST /emit` gains new ways to legitimately refuse a request: a missing or wrong
`Content-Type`, an unrecognised `Host`, a mismatched `Origin`, or a body over the size
cap. Each returns a structured `400` (or `413`) naming the offending field with a
correlation id.

On the daemon side that is the correct behaviour and is fully in scope for 0000019. The
open question is what the **caller** does with it.

The Planifest emission hooks — `planifest-framework/hooks/telemetry/emit-phase-start.mjs`,
`emit-phase-end.mjs`, and `context-pressure.mjs` — POST to `${BACKEND_URL}/emit`. The
telemetry standard defines a durable failure-marker protocol: on emission error the hook
writes a marker under `plan/.telemetry-failures/` carrying `hook`, `error_type`,
`error_message`, `occurrences`, and `root_cause_key`, which the orchestrator surfaces at
the next phase start as a block-or-proceed question.

What is unverified is whether a **non-2xx HTTP response** counts as an emission error for
that protocol, or whether the hooks only write a marker on a transport-level failure
(connection refused, timeout, DNS). If it is the latter, a refused `/emit` returns cleanly,
the hook reads "response received", and pipeline telemetry silently stops being recorded
with no marker and no prompt — the exact silent-gap failure the marker protocol exists to
prevent.

This was not a live defect before 0000019, because the daemon had no boundary checks that
could refuse a well-formed hook request. It becomes reachable the moment 0000019 ships.

## Suggested Action

- Read the three hooks' response handling and determine whether `res.ok` / status is
  checked at all, or only the `fetch` promise rejection.
- If a non-2xx is not currently treated as a failure, make it one: write a failure marker
  with `error_type` distinguishing a client-side rejection (`4xx` — the hook sent something
  the daemon refused, which is a hook bug worth surfacing loudly) from a server-side one
  (`5xx` — the daemon failed, retry-shaped).
- Use the daemon's correlation id as part of `root_cause_key` where present, so repeated
  instances of the same refusal collapse into one prompt rather than re-asking per phase.
- Add a test that stands up a daemon configured to refuse, emits, and asserts a marker
  lands under `plan/.telemetry-failures/`.

## Why Deferred

The fix lives entirely in `planifest-framework/hooks/telemetry/`. Per the Framework Update
Policy in `CLAUDE.md`, framework changes are committed directly as tooling maintenance and
are not routed through this product's P0-P9 pipeline, so this cannot be folded into
0000019's requirements. Filed here so the dependency is recorded rather than dropped.

Note the ordering: 0000019 shipping is what makes this reachable. Worth picking up in the
same window rather than long after.
