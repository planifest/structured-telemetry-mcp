# SLO Definitions - telemetry-log-viewer-ui

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000015-telemetry-log-viewer-ui
**Version:** 0.11.0

> Do not produce aspirational targets - base them on the design requirements's NFRs.

## Service Level Objectives

The confirmed design explicitly defers an availability target ("Availability target: deferred — best-effort, no SLO, local single-developer tool"). No SLO is fabricated here. The one measurable NFR from the design (latency) is tracked as a performance target, not a formal SLO with an error budget, since there is no traffic/uptime model to attach an error budget to for a single local process with no on-call.

| SLO ID | Service / Component | SLI (what is measured) | Target | Window | Error Budget |
|--------|-------------------|----------------------|--------|--------|-------------|
| N/A | structured-telemetry-mcp | — | — | — | Not applicable — no SLO defined; see NFR-001 in `execution-plan.md` for the one performance target that exists (p95 < 300ms per `event_log` query/page load), tracked as a P4 validation check, not an ongoing SLO |

## SLI Definitions

Not applicable — no SLO is defined for this feature (see above).

## Error Budget Policy

Not applicable.

## Burn Rate Alerts

Not applicable.
