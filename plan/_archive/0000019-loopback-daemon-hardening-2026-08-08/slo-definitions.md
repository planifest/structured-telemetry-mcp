---
title: "SLO Definitions - 0000019-loopback-daemon-hardening"
summary: "SLIs, SLOs and error budgets for this feature."
---
# SLO Definitions - 0000019-loopback-daemon-hardening

## Context

This is a single-user local daemon, not a hosted service. Conventional availability SLOs with error budgets and burn-rate alerting would be theatre here — there is no fleet, no traffic tier, and no on-call rotation. What follows is scoped to what is actually measurable and actually actionable on a developer's machine.

The measurements below are CI gates and local checks, not production monitoring.

## SLIs and SLOs

| SLI | SLO | How measured | Consequence of breach |
|---|---|---|---|
| Daemon survival under hostile input | 100% — zero process exits across the req-004 fuzz corpus | Regression test polls `GET /health` after each case | Blocks the release. This is the feature's headline guarantee |
| `/query` p95 latency | Under 100 ms | Existing CI performance gate, unchanged | Blocks the release, per the existing gate |
| Boundary-check overhead | Under 5 ms added to p95 | Before/after comparison at P4 | Investigate; the checks are header comparisons, so a breach implies something else changed |
| Error-body containment | 100% — no engine text, SQL fragment, or stored value in any error body | Regression test over the req-006 corpus | Blocks the release |
| Injection rejection | 100% of the req-009 corpus rejected before SQL construction | req-009 tests on both paths | Blocks the release |
| Render safety | Zero script executions across the req-010 payload corpus | Playwright dialog handler and console listener | Blocks the release |
| CI wall-clock | Combined suite under 5 minutes | CI run time at P4 | Investigate; fall back to a shared-server E2E pattern per 0000016's recorded mitigation |

## Error Budget

Not applicable in the conventional sense. Five of the seven SLOs above are 100% targets enforced as release gates rather than budgets consumed over a window — a security control that works 99% of the time is a security control that does not work.

The two latency SLOs are the only ones with headroom, and their budget is the existing CI gate's tolerance. 0000018 recorded Windows GitHub runners measuring roughly 28 ms p95 against a 100 ms gate, so there is substantial margin.

## What is deliberately not measured

- **Uptime percentage.** The daemon is supervised by launchd/systemd/nssm and restarts on failure. After this feature the interesting number is not "how often was it up" but "did a request ever take it down", which NFR-003 measures directly and absolutely.
- **Request throughput.** Local single-user traffic; no meaningful ceiling to defend.
- **Error rate.** A rising `403`/`415` rate after this feature is expected behaviour — it means the checks are working — so an error-rate SLO would alert on success. What matters is the *identity* of the caller being refused, which `operational-model.md` handles as a diagnostic, not an SLO.
