# Roadmap Item: Structured Telemetry Framework Integration (0008b)

## Source
Planifest Framework Review (April 2026) -> Section 4: The Tooling Ecosystem & Observability

## Observation
Once the [Structured Telemetry MCP Server (0008a)](0008a--feature--structured-telemetry-mcp-server.md) is available, the Planifest framework must be wired to use it. This requires an explicit opt-in mechanism and updates to all agent skills to ensure consistent event emission without creating a hard dependency on the telemetry infrastructure.

## Planifest Rating
🟠 Developing

## Recommendation
Wire the Planifest framework to the telemetry service using an explicit **opt-in flag** (`--structured-telemetry-mcp`). Update agent skills to conditionally emit events and install MCP-based hooks to capture context pressure signals.

---

## Design Goals

1. **Explicit Opt-in.** Telemetry is **disabled by default**. It is only activated when the `--structured-telemetry-mcp` setup flag is used.
2. **Zero Fallback.** If the MCP service is not provisioned, no telemetry is emitted. There are no local file-based fallbacks or baseline logs.
3. **Agent-agnostic.** Agents check for the presence of the `emit_event` tool before attempting to record telemetry.
4. **Context-Mode Ready.** Seamlessly integrates with [context-mode (0006c)](_abandoned/0006c--feature--mcp-context-mode-fork.md) hooks to capture high-fidelity context pressure data.

---

## Implementation Details

### Setup Flag
The `setup.ps1` and `setup.sh` scripts are updated to accept:
`--structured-telemetry-mcp`

When present, the script:
1. Registers the `planifest/structured-telemetry-mcp` server in the tool's configuration.
2. Sets an internal environment variable or flag that skills can detect.

### Event Emission
All primary agent skills are updated with a **Telemetry section** in their `SKILL.md`:

```markdown
### Telemetry
If the `emit_event` tool is available:
- Emit `phase_start` at the beginning of the task.
- Emit `phase_end` (with `pass` status) upon completion.
- Emit `spec_gap` if human clarification is required.
```

### Context Pressure Hooks
When both `--structured-telemetry-mcp` and `--context-mode-mcp` are used, a special `PostToolUse` hook is installed. This hook intercepts the completion of every tool call to calculate:
- `context_fill_pct`
- `unused_sources`
- `trigger` (e.g., threshold reached)

These are emitted as `context_pressure` events directly to the MCP service.

---

## Framework Changes Required

| File | Change |
|---|---|
| `setup.sh` / `setup.ps1` | Add `--structured-telemetry-mcp` flag logic to provision the service reference |
| `skills/planifest-orchestrator/SKILL.md` | Add Telemetry section: emit `phase_start`, `phase_end`, `spec_gap` |
| `skills/planifest-validate-agent/SKILL.md` | Add Telemetry section: emit `validation_failure` |
| `skills/planifest-codegen-agent/SKILL.md` | Add Telemetry section: emit `deviation`, `migration_proposal` |
| `skills/planifest-change-agent/SKILL.md` | Add Telemetry section: emit `deviation`, `migration_proposal` |

---

## Dependencies

- **0008a**: MCP Telemetry Server (The ingestion point)
- **0006c**: Context-mode (Required for automated context pressure events)

---

## Open Questions

1. **Auto-Discovery**: Should the setup script attempt to auto-discover a locally running `structured-telemetry-mcp` server if the flag is omitted? (Current decision: No - explicit only).
2. **Schema Bundling**: Should the framework bundle the telemetry schema for local validation, or rely entirely on the MCP server's validation?
