---
title: "Requirement: REQ-002 - query-bottlenecks"
summary: "query_telemetry support for phase/agent/tool/content-format duration metrics."
status: "active"
version: "0.1.0"
feature: "0000008-structured-telemetry-mcp-server"
stories: ["S1"]
---

# REQ-002 — Query: Bottleneck Visibility

## Description

The `query_telemetry` tool must support bottleneck analysis queries across all SDLC stages. These queries aggregate duration data from `phase_start` / `phase_end` event pairs, grouped by the requested dimension.

## Supported Query Dimensions

| `group_by` value | Description |
|------------------|-------------|
| `phase` | Duration per pipeline phase |
| `agent` | Duration and success rate per agent skill |
| `tool` | Call count and avg duration per tool |
| `run_id` | All phases for a single pipeline run |
| `content_type` | Duration segmented by content format (e.g. `docs`, `code`, `config`) |

## Query Interface

```json
{
  "group_by": "phase | agent | tool | run_id | content_type",
  "run_id": "<optional: scope to a single run>",
  "session_id": "<optional: scope to a session>",
  "limit": "<optional: last N runs for trend>",
  "metrics": ["avg_duration_ms", "p95_duration_ms", "success_rate"],
  "output": "markdown | json | both"
}
```

## Response Format

Returns all three of:
1. **Markdown table** — ranked by `avg_duration_ms` descending, suitable for human review in iteration logs.
2. **JSON payload** — machine-readable aggregation result.
3. **Raw event sample** — the 5 most recent matching raw events.

## Acceptance Criteria

- [ ] `group_by: "phase"` returns avg and p95 duration per phase, ranked slowest first.
- [ ] `group_by: "agent"` returns avg duration and success rate per agent skill.
- [ ] `group_by: "tool"` returns call count and avg duration per tool.
- [ ] `group_by: "content_type"` segments by the `data.content_type` field on `phase_end` events.
- [ ] `run_id` filter scopes results to a single pipeline run.
- [ ] `limit: N` returns aggregation across the last N runs only.
- [ ] All responses include Markdown table + JSON + 5-event raw sample.
- [ ] Empty result set returns `{ "ok": true, "results": [], "message": "No matching events." }`.
