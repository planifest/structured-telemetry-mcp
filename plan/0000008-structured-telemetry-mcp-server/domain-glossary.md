---
title: "Domain Glossary: 0000008-structured-telemetry-mcp-server"
version: "0.1.0"
feature: "0000008-structured-telemetry-mcp-server"
---

# Domain Glossary - 0000008-structured-telemetry-mcp-server

## Terms

| Term | Definition | Aliases | Used In |
|------|-----------|---------|---------|
| Telemetry Event | A structured record emitted by a Planifest agent at a meaningful point in the pipeline. Consists of a common envelope and a typed data payload. | event | structured-telemetry-mcp |
| Common Envelope | The fixed set of fields present on every telemetry event: `schema_version`, `event`, `session_id`, `initiative_id`, `phase`, `agent`, `tool`, `model`, `mcp_mode`, `timestamp`. | envelope | structured-telemetry-mcp |
| Event Type | The value of the `event` field in the envelope. Determines which `data` sub-schema applies. One of: `phase_start`, `phase_end`, `spec_gap`, `validation_failure`, `deviation`, `migration_proposal`, `context_pressure`, `mcp_impact`, `self_correction`. | — | structured-telemetry-mcp |
| `emit_event` | The MCP tool that accepts a telemetry event, validates it, and writes it to DuckDB. This is the single ingestion point. | — | structured-telemetry-mcp |
| `query_telemetry` | The MCP tool that accepts a structured query and returns aggregated results plus raw event samples. | — | structured-telemetry-mcp |
| Session | A single continuous agent invocation, identified by `session_id`. May span multiple phases. | agent session | structured-telemetry-mcp |
| Initiative | A specific feature or change being built, identified by `initiative_id`. Maps to a `plan/current/` directory. | feature, pipeline run | structured-telemetry-mcp |
| Phase | A discrete stage of the Planifest pipeline: `orchestrator`, `spec`, `adr`, `codegen`, `validate`, `security`, `docs`, `change`. | pipeline stage | structured-telemetry-mcp |
| Retry Instance | One logical action that required at least one retry, counted once regardless of how many attempts were made. Not the same as attempt count. | — | structured-telemetry-mcp, REQ-003 |
| Loop | A session/phase combination where 5 or more consecutive identical `validation_failure` events occur with the same `data.failure_type`. Detected at query time, not server-side. | failing loop | structured-telemetry-mcp, REQ-003 |
| Context Pressure | The percentage of the agent's context window currently in use, captured at a point in time. Stored in `context_pressure.data.context_fill_pct`. | context fill, fill % | structured-telemetry-mcp, REQ-004 |
| MCP Impact | The measured effect of enabling one or more MCP servers on context window consumption. Captured in `mcp_impact` events by the agent. | — | structured-telemetry-mcp, REQ-004 |
| MCP Mode | The combination of MCP servers active during a session. One of: `none`, `workspace`, `context`, `workspace+context`. | — | structured-telemetry-mcp |
| DuckDB | The embedded OLAP database used as the persistent telemetry store. Accessed via a single writer (the MCP server process). | — | structured-telemetry-mcp |
| WAL Mode | Write-Ahead Log mode in DuckDB. Reduces file lock contention and enables safe concurrent reads while a single writer is active. | — | structured-telemetry-mcp, REQ-006 |
| Schema Version | The version of the telemetry event schema, stored on every event row. Used to handle schema evolution without breaking existing queries. Starts at `"1.0"`. | — | structured-telemetry-mcp, REQ-005 |
| Content Type | The format of artefact being produced in a phase, recorded in `phase_end.data.content_type`. Examples: `docs`, `code`, `config`, `schema`, `test`. | content format | structured-telemetry-mcp, REQ-002 |
| Human on the Loop | The developer supervising the Planifest pipeline. The primary user of `query_telemetry`. Not an automated consumer. | operator | structured-telemetry-mcp |
| setup | The CLI command that registers the MCP server in the active agent tool's configuration file. | — | structured-telemetry-mcp, REQ-007 |
| doctor | The CLI command that diagnoses the installation: checks config, checks DuckDB file access, emits a test event. | — | structured-telemetry-mcp, REQ-007 |
| Bundle | The single-file output of the esbuild step (`server.bundle.mjs`). Referenced in agent tool configs. Runs without npm install. | server.bundle.mjs | structured-telemetry-mcp, REQ-007 |
