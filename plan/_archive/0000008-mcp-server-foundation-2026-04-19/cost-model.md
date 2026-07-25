---
title: "Cost Model: 0000008-structured-telemetry-mcp-server"
version: "0.1.0"
feature: "0000008-structured-telemetry-mcp-server"
---

# Cost Model - 0000008-structured-telemetry-mcp-server

## Summary

This is a local developer tool. There are no cloud infrastructure costs, no egress costs, and no third-party API costs.

## Cost Drivers

| Driver | Cost | Notes |
|--------|------|-------|
| Compute | $0 | Runs on developer's local machine |
| Storage | $0 | DuckDB file on local filesystem; estimated < 500MB for 1M events |
| Egress | $0 | No network calls; stdio transport only |
| npm registry | $0 | Public package on npmjs.com (when published); free tier |
| GitHub Actions | $0 | Public repository; CI minutes are free |
| DuckDB licence | $0 | MIT licence |
| `@modelcontextprotocol/sdk` | $0 | Apache-2.0 licence |

## Total Cost

**$0** — no ongoing cost at any scale for the local dev tool use case.

## Future Cost Considerations

If the tool is later hosted (e.g. as a shared team service), compute and storage costs would apply. This is explicitly deferred and not costed here.
