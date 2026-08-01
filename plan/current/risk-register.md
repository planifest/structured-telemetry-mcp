---
title: "Risk Register - telemetry-log-viewer-ui"
summary: "Technical, operational, and security risks with their mitigations."
status: "active"
version: "0.1.0"
---
# Risk Register - telemetry-log-viewer-ui

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md) (updated by any agent that identifies a new risk)
**Feature:** 0000015-telemetry-log-viewer-ui
**Version:** 0.11.0
**Overall Risk Level:** low

## Risks

| ID | Category | Description | Likelihood | Impact | Mitigation | Status |
|----|----------|------------|------------|--------|-----------|--------|
| R-001 | technical | Removing the mandatory scope-filter requirement on `event_log` (ADR-010 relaxation) is enforced in two separate places today — `src/query/event-log.ts` and `src/server-factory.ts`'s `dispatchQuery` pre-check — and both must be updated together or the contract stays inconsistent between the two call paths | medium | medium | Codegen-agent updates both files in the same commit; P4 validation runs the full suite, not just one path's tests | open |
| R-002 | technical | Three existing tests explicitly assert the old "requires at least one scope parameter" error (`tests/unit/server-factory.test.ts:125`, `tests/integration/query-telemetry.test.ts:256`, `tests/regression/query-routing.test.ts:132`) and will fail once the requirement is removed | high | low | Named explicitly in req-002's acceptance criteria; update all three to assert the new permissive contract instead of deleting coverage | open |
| R-003 | technical | Expanding `event_log`'s SELECT to return every `events` column increases per-row payload size; at large page sizes this could push against the p95 < 300ms NFR | low | low | Default page sizes stay modest (confirmed design); revisit (e.g. lean vs. full row modes) only if NFR is measured and missed at P4 | open |
| R-004 | operational | `product_id`'s DB migration requires human approval before the column exists; req-002/003/004 all read or filter on `product_id`, so delayed approval blocks downstream work | medium | medium | Build order sequences req-001 first (confirmed design); codegen-agent seeks migration approval early in P3 before starting req-002 | open |
| R-005 | security / privacy | `product_id` values are absolute filesystem paths (e.g. `/Users/martinmayer/d/planifest/telemetry-mcp`), which can reveal local usernames/directory structure. Currently low-risk because the server is 127.0.0.1-only with no auth and no remote exposure (NFR-002/NFR-003) | low | medium | Document the constraint in the data contract; re-assess if this component's no-auth/local-only posture ever changes (tracked as a scope boundary, not solved here) | accepted |
| R-006 | technical | Historical rows (and any event from an emitter not yet updated, e.g. planifest-framework's own hooks pre-backlog-pickup) permanently show `product_id` as "unknown" — by design, not a defect, but could be mistaken for a bug during P4/P5 review if undocumented | certain | low | Explicitly called out in req-001 acceptance criteria, scope.md Deferred section, and this risk register | accepted |

## Assumptions Logged as Risks

Documented assumptions from the specification are logged here with likelihood: medium.

| ID | Assumption | Impact if Wrong | Status |
|----|-----------|----------------|--------|
| A-001 | The existing `server-http.ts` process is the right place to serve the UI's static assets | UI would need its own process/port, adding deployment complexity | open |
| A-002 | Local event volumes are small enough for offset pagination to perform acceptably | Revisit pagination strategy (e.g. cursor-based) if the p95 latency NFR is missed at realistic data volumes | open |
| A-003 | No existing MCP/REST caller depends on the old scope-required error as intentional behavior — only test assertions reference it, not application logic | A caller's error-handling path becomes silently unreachable; harmless but worth a final grep sweep at P4 | open |
