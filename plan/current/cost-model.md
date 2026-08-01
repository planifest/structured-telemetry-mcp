# Cost Model - telemetry-log-viewer-ui

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000015-telemetry-log-viewer-ui
**Version:** 0.11.0

> Estimates must be based on the design requirements's scale requirements.

## Summary

| Category | Estimated Monthly Cost | Notes |
|----------|----------------------|-------|
| Compute | $0 | Runs inside the existing local `server-http.ts` process — no new process, container, or instance |
| Storage | $0 | One new nullable VARCHAR column on an existing local DuckDB table — negligible bytes/row, no new storage tier |
| Network / Egress | $0 | Local-only (127.0.0.1); no external network calls by design (NFR-003) |
| Third-party Services | $0 | No third-party services used or added |
| **Total** | **$0** | Local, single-developer tool — no cloud spend of any kind |

## Compute Costs

Not applicable — no new compute resource. The UI is static assets served by the existing local Node process.

## Storage Costs

Not applicable at cloud-billing granularity. Local disk impact: one additional nullable VARCHAR column on the `events` table — effectively free relative to existing row sizes (`data`/`model_config` JSON columns already dominate row size).

## Network / Egress Costs

Not applicable — server is bound to 127.0.0.1 only; the UI makes zero external network calls (NFR-003).

## Third-party Services

None.

## Assumptions

1. This feature runs entirely on the developer's own machine, with no cloud infrastructure, matching the existing project's local-only cost posture (unchanged from prior features 0000008–0000014).
2. Local event volumes remain small enough that the new `product_id` column and expanded query results do not meaningfully change local disk usage (see risk-register.md A-002).
