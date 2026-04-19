---
title: "Requirement: REQ-003 - query-failures"
summary: "query_telemetry support for retry instances, pass/fail rates, and failure sequences."
status: "active"
version: "0.1.0"
feature: "0000008-structured-telemetry-mcp-server"
stories: ["S2"]
---

# REQ-003 — Query: Failure and Loop Detection

## Description

The `query_telemetry` tool must support failure analysis queries. The server stores raw events only — loop detection is query-side. A retry instance is defined as any action that required at least one retry, regardless of how many attempts were made. The loop threshold is 5+ consecutive identical `validation_failure` events within a single phase.

## Key Definitions

- **Retry instance**: One logical action that required at least one retry. Counted once per action, not per attempt.
- **Loop**: 5+ consecutive `validation_failure` events with the same `data.failure_type` within a single `session_id` + `phase` combination.
- **Pass within 5**: A retry instance that ultimately succeeded within 5 attempts.
- **Fail within 5**: A retry instance that did not succeed within 5 attempts.

## Supported Query Modes

### Mode A — Retry summary
```json
{
  "event": "validation_failure",
  "group_by": "session_id,phase",
  "metrics": ["retry_instance_count", "pass_rate_within_5_retries", "fail_rate_within_5_retries"]
}
```

### Mode B — Loop candidates (sessions exceeding threshold)
```json
{
  "event": "self_correction",
  "group_by": "session_id",
  "having": "consecutive_count >= 5"
}
```

### Mode C — Failure sequence for a session
```json
{
  "session_id": "<id>",
  "event_types": ["phase_start", "validation_failure", "self_correction", "phase_end"],
  "order": "timestamp",
  "output": "raw"
}
```

### Mode D — Failure cluster by phase (cross-run)
```json
{
  "event": "validation_failure",
  "group_by": "phase",
  "metrics": ["total_count", "unique_session_count"]
}
```

## Response Format

All modes return:
1. **Markdown table** — ranked by failure count or retry instances.
2. **JSON payload** — structured result.
3. **Raw event sample** — 5 most recent matching events (full envelope + data).

## Acceptance Criteria

- [ ] Mode A returns retry_instance_count, pass_rate_within_5_retries, fail_rate_within_5_retries per session/phase.
- [ ] Mode B identifies sessions where consecutive identical failures >= 5 within a single phase.
- [ ] Mode C returns the full ordered event timeline for a session, filtered to specified event types.
- [ ] Mode D shows which phases have the highest failure cluster across all runs.
- [ ] Retry instance count treats each logical action as 1, not each attempt.
- [ ] All responses include Markdown table + JSON + raw sample.
