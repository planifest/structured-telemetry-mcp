# Dependency Graph

> Living document. Shows how components relate. Updated after every pipeline run.
> Do not archive this file — update it in place.

Last updated: 0000016-e2e-playwright-test-suites

---

## Component Dependencies

Single-component repository — no inter-component dependencies exist within this repo.

```mermaid
flowchart LR
    Agent[Agent tool<br/>Claude Code, Cursor, etc.] -->|MCP stdio| Server[structured-telemetry-mcp]
    Server -->|writes/reads| DB[(DuckDB<br/>telemetry.db)]
    Human[Human on the loop] -->|query_telemetry| Server
    Browser[Human's browser<br/>Log Viewer UI] -->|GET /ui, POST /query| Server

    Windows[Windows: nssm] -.->|supervises| Server
    MacOS[macOS: launchd user agent] -.->|supervises| Server
    Linux[Linux: systemd --user] -.->|supervises| Server
```

---

## External System Dependencies

```mermaid
flowchart LR
    Server[structured-telemetry-mcp] -->|events| PlanifestFramework[planifest-framework<br/>sibling repo]
    PlanifestFramework -.->|consumes 4 new event types<br/>loop_iteration, phase_reversal_*| Server
```

`planifest-framework` (a sibling repo, not part of this codebase) is a downstream consumer of the `emit_event` tool contract — added in `0000010-macos-launchd-service` for its `planifest-loop-runner` and phase-reversal-protocol skills. No code dependency in either direction; the relationship is entirely through the MCP tool call contract and the shared `schemas/telemetry-event.schema.json` file.

---

*Template: dependency-graph (see architecture-overview.template.md for related living-doc conventions)*
