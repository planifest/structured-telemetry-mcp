---
title: "Requirement: req-008 - Independent cap on MCP tool-result text"
summary: "Detailed requirements for this specific functional feature."
status: "draft"
version: "0.1.0"
---
# Requirement: req-008 - Independent cap on MCP tool-result text

**Skill:** [spec-agent](../../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000019-loopback-daemon-hardening
**Source:** US-008
**Priority:** must-have

## User Story

As an agent consumer, I want the MCP tool-result text capped independently of the HTTP response, so that a large result cannot flood a context window.

## Current defect

`src/server-factory.ts:192-199` builds the MCP tool-result text by concatenating the markdown **plus** two pretty-printed JSON serialisations:

```ts
'```json\n' + JSON.stringify(response.json, bigIntReplacer, 2) + '\n```',
'```json\n' + JSON.stringify(response.rawSample, bigIntReplacer, 2) + '\n```',
```

A single query therefore produces several multiples of the raw row bytes in peak memory, and pushes all of it into an agent's context window. Indent-2 pretty-printing inflates it further.

## Why this is separate from req-007

req-007 bounds how many **rows** a query returns. This requirement bounds how much **text** the MCP path serialises from whatever it got back. They are different constraints with different limits: an agent's context window is tighter than the daemon's memory, and a result that is perfectly reasonable over HTTP can still be too large to paste into a conversation. Satisfying req-007 does not satisfy this requirement, and vice versa.

## Functional Requirements

- The assembled MCP tool-result text is capped at a documented character budget. Default **100,000 characters**, overridable via `PLANIFEST_MCP_TEXT_BUDGET`.
- When the budget is exceeded, the text is truncated at a section boundary rather than mid-JSON, so what the agent receives is always parseable — never a JSON block cut in half.
- A truncated result states plainly that it was truncated, reports the full `total_count` where req-007 makes it available, and names the narrower query that would return a complete result.
- Truncation priority when the budget is tight: keep the markdown summary, then the JSON payload, then the raw sample. The raw sample is the first thing dropped.
- The HTTP response is **not** affected by this cap. An HTTP caller that legitimately wants the full bounded result still receives it.

## Acceptance Criteria

- [ ] A query exceeding the budget returns a tool result under the budget in which every fenced JSON block present is complete and parseable — no block is cut mid-structure
- [ ] A truncated result states that truncation occurred and reports `json.total_count` when the underlying mode supplies it; under a progressively tighter budget the raw sample is dropped first, then the JSON payload, then the markdown last
- [ ] The same query over HTTP returns the full req-007-bounded result unaffected by this cap, and a normal-sized result is byte-identical to its current output

## Dependencies

- req-007 supplies `total_count` for the truncation notice.
- Applies to `src/server-factory.ts:192-199`, the MCP `query_telemetry` result assembly.
