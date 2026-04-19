---
title: "Requirement: REQ-021 - structured-telemetry-mcp phase enum gains 'ship'"
summary: "The MCP server's phase enum is updated to include 'ship' as a valid value, coordinated with ship-agent deployment."
status: "draft"
version: "0.1.0"
---
# Requirement: REQ-021 - structured-telemetry-mcp ship enum addition

**Skill:** [spec-agent](../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000003-hook-based-enforcement
**Source:** Feature brief Structured-telemetry-mcp coordinated section; execution-plan risk register
**Priority:** must-have

---

## Functional Requirements

- The `phase` enum in the structured-telemetry-mcp schema is updated to add `"ship"` as a valid value.
- `"change"` is retained in the enum (the change-agent still uses it).
- The MCP server update is deployed before `planifest-ship-agent/SKILL.md` is merged — the ship-agent references `"phase": "ship"` and will fail telemetry validation if the enum is not present.
- The deploy is coordinated: MCP server update → merge ship-agent → merge orchestrator routing update.
- Any existing telemetry queries that filter `phase = "change"` are unaffected (additive change only).
- **Functional impact if deploy order is violated:** ship-agent hook scripts exit 0 on schema rejection (telemetry gap only — ship-agent execution is never blocked).
- **CI guard:** The ship-agent PR includes a CI check that POSTs a test event with `"phase": "ship"` to the configured MCP endpoint. The build fails if the schema rejects it, enforcing the deploy order automatically.

## Acceptance Criteria

- [ ] MCP server schema accepts `"ship"` as a valid `phase` value without error.
- [ ] `"change"` remains valid (no regression for change-agent telemetry).
- [ ] MCP server update is deployed before ship-agent code is merged.
- [ ] Telemetry query for `phase = "ship"` returns ship-phase events correctly.

## Dependencies

- This is a coordinated deploy — see risk R-001 in the risk register.
- structured-telemetry-mcp repository (external to this framework repo).
