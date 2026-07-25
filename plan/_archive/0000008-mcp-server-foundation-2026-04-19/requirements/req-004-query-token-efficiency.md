---
title: "Requirement: REQ-004 - query-token-efficiency"
summary: "query_telemetry support for context pressure and request volume metrics."
status: "active"
version: "0.1.0"
feature: "0000008-structured-telemetry-mcp-server"
stories: ["S3"]
---

# REQ-004 — Query: Token and Request Efficiency

## Description

The `query_telemetry` tool must support token and request efficiency analysis. These queries target `context_pressure` and `mcp_impact` events. The goal is to identify which operations consume the most context window and to track that number improving across successive runs.

## Supported Query Modes

### Mode A — Context pressure by phase
```json
{
  "event": "context_pressure",
  "group_by": "phase",
  "metrics": ["avg_peak_fill_pct", "max_peak_fill_pct"],
  "output": "both"
}
```

### Mode B — MCP server impact
```json
{
  "event": "mcp_impact",
  "group_by": "mcp_mode",
  "metrics": ["avg_token_delta", "avg_peak_fill_pct"]
}
```

### Mode C — Request volume hot spots
```json
{
  "group_by": "agent",
  "metrics": ["total_tool_calls", "avg_calls_per_phase"]
}
```

### Mode D — Trend over time (continual improvement tracking)
```json
{
  "event": "context_pressure",
  "group_by": "run_date",
  "metrics": ["avg_peak_fill_pct", "max_peak_fill_pct"],
  "order": "run_date asc"
}
```

### Mode E — Drill-down: event detail for a specific operation
```json
{
  "session_id": "<id>",
  "event_types": ["context_pressure", "mcp_impact"],
  "output": "raw"
}
```
Returns full event detail including `data.unused_sources`, `data.trigger`, `data.context_fill_pct` so the operator understands *why* pressure was high.

## Response Format

All modes return:
1. **Markdown table** — ranked by consumption metric descending.
2. **JSON payload** — structured aggregation result.
3. **Raw event sample** — 5 most recent matching events (full envelope + data).

## Acceptance Criteria

- [ ] Mode A returns avg and max peak context fill % per phase, ranked highest first.
- [ ] Mode B shows the token delta (reduction or increase) per mcp_mode configuration.
- [ ] Mode C returns total tool calls and avg calls per phase, per agent.
- [ ] Mode D returns trend data ordered chronologically for continual improvement tracking.
- [ ] Mode E returns full raw event detail for a session including the `data` payload.
- [ ] All responses include Markdown table + JSON + raw sample.
- [ ] `data.unused_sources`, `data.trigger`, and `data.context_fill_pct` are surfaced in drill-down results.
