# Cost Model - log-viewer-enhancements

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000017-log-viewer-enhancements
**Version:** 0.13.0

> Estimates must be based on the design requirements's scale requirements.

## Summary

| Category | Estimated Monthly Cost | Notes |
|----------|----------------------|-------|
| Compute | $0 | Runs inside the existing local `server-http.ts` process — no new process, container, or instance |
| Storage | $0 | No schema/DB change — this feature reads existing columns only |
| Network / Egress | $0 | Local-only (127.0.0.1); no external network calls by design (NFR-005), including the new auto-refresh polling and suggestion fetches |
| Third-party Services | $0 | No third-party services used or added |
| **Total** | **$0** | Local, single-developer tool — no cloud spend of any kind |

## Compute Costs

Not applicable — no new compute resource. Auto-refresh polling and suggestion lookups add marginal local CPU/query load only, bounded by NFR-001 (p95 < 300ms) and a 5-second poll interval (req-001).

## Storage Costs

Not applicable — no schema change in this feature.

## Network / Egress Costs

Not applicable — server is bound to 127.0.0.1 only; the UI makes zero external network calls (NFR-005).

## Third-party Services

None.

## Assumptions

1. This feature runs entirely on the developer's own machine, with no cloud infrastructure, matching the existing project's local-only cost posture (unchanged from prior features 0000008–0000016).
2. The 5-second auto-refresh poll interval (req-001) does not meaningfully increase local DuckDB CPU/disk load at single-developer data volumes (see risk-register.md A-002 for the related distinct-values query volume assumption).
