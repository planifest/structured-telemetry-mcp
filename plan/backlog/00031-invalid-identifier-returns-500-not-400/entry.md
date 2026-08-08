---
title: "Backlog Entry: 00031 - Invalid sortField/field returns a redacted 500, not a field-named 400"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
severity: "low"
---
# Backlog Entry: 00031 - Invalid sortField/field returns a redacted 500, not a field-named 400

**Source feature:** 0000019-loopback-daemon-hardening
**Source phase:** P5 (security review, finding L2)

**Date filed:** 2026-08-08

---

## Problem

An invalid `sortField` (event_log), `field` (distinct_values), or `group_by`
(bottlenecks) value is rejected — the allow-list throws before any SQL is built,
so injection is fully blocked and no value leaks. But at the HTTP boundary that
throw is caught by `respondError()` and mapped to the engine class: a **redacted
500 with a correlationId**, not the **field-named 400** req-009 and req-006
describe for invalid client input.

The security consequence is nil (the P5 review rated it Low, "not a
vulnerability" — injection blocked, value redacted). It is a status-code
conformance gap: a client sending a bad identifier gets a 500 that reads as "the
server failed" rather than a 400 that reads as "your input was invalid, field X".

## Suggested Action

- Move the `sortField` / `field` / `group_by` allow-list membership check into
  the shared gate (`src/query/validate-query.ts`), or a sibling gate, so an
  invalid identifier is rejected with a field-named 400 *before* dispatch —
  consistent with how the numeric fields are already handled.
- Keep the query-module allow-list checks (event-log.ts, distinct-values.ts) as
  defense-in-depth; the gate becomes the primary, the module the backstop.
- Update req-009's injection test to assert the 400 + field name at the HTTP
  layer, not only the `.rejects.toThrow()` at the service layer.

## Why Deferred

The boundary pass (server-http.ts) and the shared gate were frozen and green at
ship time; reopening them for a Low, non-security status-code refinement at P5
was not worth the regression risk against a security-hardening release. The
protection this feature exists to deliver (injection blocked, no leak) is fully
in place. This is a conformance polish for a follow-up.
