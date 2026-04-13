# Roadmap Item: Structured Telemetry MCP Server (0008a)

## Source
Planifest Framework Review (April 2026) -> Section 4: The Tooling Ecosystem & Observability

## Observation
Planifest keeps an excellent textual audit trail (`pipeline-run.md`, `iteration-log.md`) which serves well for human review. However it lacks systemic telemetry — logging token pressure, execution durations, tool call volumes, or spec gap frequency — which means the framework can only be improved by intuition. This roadmap item focuses on building the **standalone MCP server** that provides the infrastructure for recording this data.

## Planifest Rating
🟠 Developing

## Recommendation
Build a standalone **Structured Telemetry MCP Server** in a dedicated repository. This server will provide high-performance event ingestion (via DuckDB) and a standardized tool interface for any Planifest-compliant agent to emit and query structured telemetry.

---

## Design Goals

1. **Standalone Repository.** Hosted at `planifest/structured-telemetry-mcp`.
2. **High Performance Store.** Use DuckDB for high-throughput temporal data storage (millions of records).
3. **Tool-Driven Emission.** Provides the `emit_event` and `query_telemetry` tools to the agent environment.
4. **Schema Enforcement.** Validates all events against a central schema at the point of ingestion.
5. **Actionable.** Every metric must answer a question that drives a concrete framework improvement.

---

## Storage Technology Rationale: DuckDB

To support querying millions of events with minimal system load, **DuckDB** is selected as the primary analytical engine for the telemetry store.

### Why DuckDB?
- **Columnar Performance**: DuckDB is an in-process SQL OLAP (Online Analytical Processing) database. Its columnar storage format is optimized for traditional "log-style" analysis—allowing it to aggregate millions of telemetry records (token counts, durations, pass rates) in milliseconds.
- **Zero-Infrastructure**: Like SQLite, DuckDB is a single C++ library with no external dependencies. It requires no server to manage and stores all data in a single local file (`.planifest/telemetry.db`), aligning with the Planifest "local-first" philosophy.
- **Vectorized Execution**: It is highly optimized for modern CPUs, ensuring that recording telemetry does not create overhead that slows down the primary agentic pipeline.
- **Analytical Power**: It provides standard SQL access to complex temporal data, enabling real-time trend analysis (e.g., comparing MCP impact across thousands of runs) with sub-millisecond latency.

---

## Querying & Reporting

The structured telemetry system provides three layers of access to its data:

### 1. The `query_telemetry` MCP Tool
This is the primary interface for agents. It allows them to programmatically extract insights from the DuckDB store without needing to write raw SQL.
- **Filtering**: Query by `session_id`, `agent`, `phase`, or `timestamp` range.
- **Aggregation**: Built-in support for calculating `avg_duration`, `success_rate`, and `token_efficiency`.
- **Output**: Returns JSON for programmatic processing or Markdown tables for human review in transition logs.

### 2. Analytical CLI (`planifest telemetry report`)
A standalone CLI tool provided by the MCP server package for human developers.
- **Metric Dashboards**: Generates a terminal-based dashboard showing recent pipeline health.
- **Snapshot Export**: Export specific query results to `.md` artifacts or `.csv` for external analysis.
- **Health Checks**: Automates the detection of "toxic" components or prompts that consistently fail validation loops.

### 3. Direct SQL (DuckDB)
For power users and Phase 2 (0024) integration, the DuckDB file can be opened directly by any DuckDB-compatible client (including the `duckdb` CLI or Python/Node.js libraries). 
- **Ad-hoc Analysis**: Perfect for deep-dives into unusual context pressure spikes or identifying patterns across thousands of initiatives.
- **Visualization**: Serves as the data source for the future [Observability Store (0024)](_ideas/0024--feature--observability-store-pipeline-metrics.md) web dashboard.

---

## Event Schema

### Common envelope

All events share this envelope regardless of type:

```json
{
  "schema_version": "1.0",
  "event": "<event_type>",
  "session_id": "<context-mode session ID or generated UUID>",
  "initiative_id": "<initiative ID from plan/current>",
  "phase": "<orchestrator | spec | adr | codegen | validate | security | docs | change>",
  "agent": "<skill name, e.g. planifest-codegen-agent>",
  "tool": "<agentic tool, e.g. claude-code | cursor | antigravity>",
  "model": "<model identifier>",
  "mcp_mode": "none | workspace | context | workspace+context",
  "timestamp": "<ISO 8601>",
  "data": { }
}
```

The `mcp_mode` field is written once at session start from the active setup configuration and stamped on every event. It is the primary dimension for MCP impact analysis — all comparative metrics GROUP BY this field.

### Event types

#### `phase_start` / `phase_end`
Emitted at the beginning and end of each pipeline phase. `phase_end` includes a `pass` boolean.

```json
{
  "event": "phase_end",
  "phase": "codegen",
  "data": {
    "pass": true,
    "duration_seconds": 847,
    "self_corrections": 2,
    "requirements_completed": 8,
    "requirements_total": 8
  }
}
```

#### `spec_gap`
Emitted when the orchestrator paused to request human clarification during Phase 0 or spec.

```json
{
  "event": "spec_gap",
  "phase": "spec",
  "data": {
    "gap_type": "missing_stack_decision | ambiguous_scope | missing_data_ownership | other",
    "question": "<the question asked>",
    "resolution": "human_answered | deferred | out_of_scope"
  }
}
```

#### `deviation`
Emitted when an agent documents a deviation from the spec in `quirks.md` or `component.yml`.

```json
{
  "event": "deviation",
  "phase": "codegen",
  "data": {
    "component_id": "...",
    "type": "documented_deviation | escalation",
    "description": "<brief description>",
    "spec_artifact": "execution-plan | openapi-spec | adr | data-contract"
  }
}
```

#### `validation_failure`
Emitted each time the validate-agent encounters a failing check and enters a self-correction loop.

```json
{
  "event": "validation_failure",
  "phase": "validate",
  "data": {
    "component_id": "...",
    "check": "lint | typecheck | unit_tests | integration_tests | e2e | sast",
    "attempt": 1,
    "error_count": 14,
    "resolved": false
  }
}
```

#### `context_pressure`
Emitted by context-mode (0006c) via `PostToolUse` hook. See [0006a — Server Interaction](0006a--planifest-feature--mcp-integration-framework.md) for full design rationale (Law of Two Feet).

```json
{
  "event": "context_pressure",
  "phase": "codegen",
  "data": {
    "context_fill_pct": 74,
    "unused_sources": ["risk-register.md", "domain-glossary.md"],
    "trigger": "tool_output_unread | context_fill_threshold | index_without_search"
  }
}
```

#### `migration_proposal`
Emitted when the codegen or change agent halts and writes a schema migration proposal.

```json
{
  "event": "migration_proposal",
  "phase": "codegen",
  "data": {
    "component_id": "...",
    "proposal_path": "src/.../docs/migrations/proposed-....md",
    "destructive": true
  }
}
```

#### `mcp_impact`
Emitted at `phase_end` **by the agent in all modes** — including `mcp_mode = none`. This is the cross-mode baseline signal. Because it must work without any MCP infrastructure, the agent always self-reports it. When 0006c is active, the hook layer enriches the values; when it is not, the agent estimates from its own context history.

```json
{
  "event": "mcp_impact",
  "phase": "codegen",
  "mcp_mode": "none",
  "data": {
    "tool_calls_total": 41,
    "workspace_mcp_calls": 0,
    "native_file_reads": 31,
    "context_sandbox_calls": 0,
    "context_fill_peak_pct": 85,
    "measurement_method": "agent_estimate"
  }
}
```

With 0006c active, `measurement_method` is `"hook"` and `context_fill_peak_pct` is the precise value from the `PostToolUse` hook. Without 0006c, it is `"agent_estimate"` — the agent's self-reported sense of how full its context was at peak. Agent estimates are consistently imprecise in the same direction, so trends are valid even if absolute values are not. Queries should split on `measurement_method` when precision matters.

### Event activation table

This table clarifies that telemetry is an all-or-nothing system based on the `--structured-telemetry-mcp` flag.

| Event | `--structured-telemetry-mcp` | No Flag | Emitted by |
|---|---|---|---|
| `phase_start` / `phase_end` | ✅ | ❌ | Agent |
| `spec_gap` | ✅ | ❌ | Agent |
| `deviation` | ✅ | ❌ | Agent |
| `validation_failure` | ✅ | ❌ | Agent |
| `migration_proposal` | ✅ | ❌ | Agent |
| `mcp_impact` | ✅ | ❌ | Agent |
| `context_pressure` | ✅ (if 0006c active) | ❌ | 0006c hook |

If the flag is absent, agents do not attempt to emit telemetry and no log store is provisioned.

---


## Metrics

| Metric | Formula | What it reveals |
|---|---|---|
| **First-Pass Rate** | `phase_end(pass=true, self_corrections=0)` / total `phase_end` | How often the framework produces correct output without looping |
| **Self-Correction Rate** | avg `self_corrections` across `phase_end` events | Validate loop efficiency; high values → spec quality or codegen discipline issues |
| **Spec Gap Frequency** | count `spec_gap` per initiative | Brief quality — high frequency → human context entering the pipeline too late |
| **Spec Gap Resolution Rate** | `spec_gap(resolution=human_answered)` / total `spec_gap` | How many gaps get answered vs. deferred or scoped out |
| **Context Pressure Score** | count `context_pressure` per phase / phase duration | Which phases are structurally over-loaded |
| **Unused Source Rate** | avg `len(unused_sources)` across `context_pressure` events | Which documents habitually enter context but contribute nothing |
| **Workspace Routing Rate** | `mcp_impact.workspace_mcp_calls` / (`workspace_mcp_calls` + `native_file_reads`) | % of document reads served via 0006b vs raw filesystem — primary 0006b impact metric |
| **Context Peak Reduction** | avg `context_fill_peak_pct` grouped by `mcp_mode` | Comparative peak context fill — primary 0006c impact metric |
| **MCP Compounding Ratio** | Context peak for `workspace+context` / context peak for `none` | Net multiplicative benefit of running both servers together |
| **Deviation Rate** | count `deviation` per initiative | How often implementation diverges from spec; tracks spec quality over time |
| **Destructive Migration Rate** | `migration_proposal(destructive=true)` / total proposals | Risk proxy for schema change management |
| **Phase Duration** | `phase_end.timestamp` - `phase_start.timestamp` | Baseline for pipeline performance trend analysis |

---

## MCP Impact Measurement

The core question this telemetry must answer: **does adding each MCP server reduce context pressure, and by how much?** Precision is not required — consistency and comparability across runs are what matter.

### The baseline problem and how it is solved

When `mcp_mode = none`, there is no 0006c running — no hooks, no `context_pressure` events, no automatic fill measurement. The infrastructure that would measure the baseline is the thing not being used. This is an accepted gap.

The solution: `mcp_impact` is **agent-emitted in all modes**. In `none` mode, the agent self-reports its tool call counts and estimates `context_fill_peak_pct` from its own context history (`measurement_method: agent_estimate`). This gives a comparable baseline — imprecise in absolute terms but consistent enough for trend comparison.

### What drives each measurement

| Server | Signal | Available in | Emitted by |
|---|---|---|---|
| **None (baseline)** | `mcp_impact` with `agent_estimate` | All modes | Agent |
| **0006b workspace** | `workspace_mcp_calls` vs `native_file_reads` in `mcp_impact` | All modes | Agent |
| **0006c context-mode** | `context_fill_peak_pct` (hook-measured) + `context_pressure` events | `context` and `workspace+context` only | 0006c hooks |
| **Both combined** | `context_fill_peak_pct` grouped by `mcp_mode` across all four values | All modes (mixed method) | Agent + hooks |

### Comparing across methods

When comparing `context_fill_peak_pct` between `none` (agent estimate) and `context` (hook-measured), the values are not equivalent in precision but are comparable in direction. A 20-point difference in peak fill is meaningful even across methods. Filter on `measurement_method` when building dashboards to keep the distinction visible:

```sql
-- Separate views for clean comparison
SELECT mcp_mode, AVG(json_extract(data, '$.context_fill_peak_pct')) AS avg_peak,
       json_extract(data, '$.measurement_method') AS method
FROM events WHERE event = 'mcp_impact'
GROUP BY mcp_mode, method;
```


### Example queries (Phase 2 SQLite layer)

**0006b impact — workspace routing rate by phase:**
```sql
SELECT
  phase,
  mcp_mode,
  AVG(CAST(json_extract(data, '$.workspace_mcp_calls') AS REAL)
    / NULLIF(json_extract(data, '$.workspace_mcp_calls')
           + json_extract(data, '$.native_file_reads'), 0)) AS routing_rate
FROM events
WHERE event = 'mcp_impact'
GROUP BY phase, mcp_mode
ORDER BY phase, mcp_mode;
```

**0006c impact — average peak context fill by MCP mode:**
```sql
SELECT
  mcp_mode,
  AVG(json_extract(data, '$.context_fill_peak_pct')) AS avg_peak_fill,
  COUNT(*) AS sample_size
FROM events
WHERE event = 'mcp_impact'
GROUP BY mcp_mode
ORDER BY avg_peak_fill ASC;
```

**Combined compounding ratio:**
```sql
SELECT
  mcp_mode,
  AVG(json_extract(data, '$.context_fill_peak_pct')) AS avg_peak
FROM events
WHERE event = 'mcp_impact'
GROUP BY mcp_mode;
-- Compounding ratio = avg_peak(workspace+context) / avg_peak(none)
```

**Unused sources by mode — which documents are redundant without 0006b:**
```sql
SELECT
  mcp_mode,
  json_each.value AS unused_source,
  COUNT(*) AS frequency
FROM events, json_each(json_extract(data, '$.unused_sources'))
WHERE event = 'context_pressure'
GROUP BY mcp_mode, unused_source
ORDER BY mcp_mode, frequency DESC;
```

---

## Collection Architecture

### Phase 1 — Integrated MCP Telemetry Service

The telemetry layer is implemented as a dedicated **MCP Telemetry Service**. This service acts as the central ingestion and query engine for all framework telemetry, avoiding the fragmentation of file-per-log storage.

**Storage Technology:**
- **Primary Engine**: [DuckDB](https://duckdb.org/) (chosen for high-performance OLAP/analytics on millions of records with near-zero configuration).
- **Protocol**: The service acts as an MCP server, allowing any Planifest-compliant agent to `emit_event` or `query_telemetry` via standard MCP tool calls.
- **Temporal Optimization**: DuckDB handles the timestamp-ordered telemetry streams efficiently, allowing for real-time aggregation of pipeline health metrics without blocking the filesystem.

**How it works:**
1.  **Ingestion**: The service continues to monitor `*.telemetry.jsonl` files (for backward compatibility and resiliency) while also accepting direct TCP/IPC event streams from high-volume tools.
2.  **Indexing**: Events are automatically indexed into a local DuckDB file (`.planifest/telemetry.db`).
3.  **Analysis**: Humans and orchestrators can run complex analytical queries (e.g., "Compare first-pass rates of Mode A vs Mode B over the last 10,000 runs") with sub-millisecond response times.

### Phase 3 — 0024 integration (Long-term)

The MCP Telemetry Service serves as the ingestion and query engine for the [Observability Store for Pipeline Quality Metrics (0024)](_ideas/0024--feature--observability-store-pipeline-metrics.md). 0024 becomes the UI/Analytics layer on top of this robust MCP data service.

---

## Dependencies

| Dependency | Required for |
|---|---|
| **0006c (context-mode fork)** | `context_pressure` events — without 0006c, this metric category is absent entirely |
| **Orchestrator skill update** | Phase boundary events — the orchestrator must be updated to emit `phase_start`/`phase_end` structured output |
| **Agent skill updates** | Each phase skill needs a Telemetry section specifying which events it emits |

---

## Framework Changes Required

| File | Change |
|---|---|
| `schemas/` | Add `telemetry-event.schema.json` — JSON Schema for the common envelope + all event type payloads |
| `src/server.ts` | Implement MCP server with `emit_event` and `query_telemetry` tools |
| `src/db/` | Implement DuckDB storage layer with temporal optimization |
| `src/validation/` | Implement run-time schema validation for ingestion |

---

## Open Questions

1. **Who validates the schema?** Should the validate-agent check that a `telemetry.jsonl` file exists and events are schema-valid before passing the pipeline gate? Or is telemetry best-effort?
2. **Sensitive data in events?** `spec_gap.question` may contain business logic. Should it be hashed or omitted in environments where telemetry is shipped externally?
3. **Agent-emitted vs. hook-emitted:** For phase boundary events, should the agent write the JSONL directly (simpler), or should context-mode intercept agent structured output and route it to the sidecar (more reliable but adds coupling)?
4. **Backfill:** Existing `iteration-log.md` files have no structured counterpart. Is a one-time migration script worth building, or do we accept a clean-slate start date?
