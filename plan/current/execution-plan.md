---
title: "Execution Plan - 0000019-loopback-daemon-hardening"
summary: "Non-functional requirements and the API/data summary for this feature."
---
# Execution Plan - 0000019-loopback-daemon-hardening

**Feature:** 0000019-loopback-daemon-hardening · **Version:** 0.15.0 · **Adoption mode:** standard-iterative

Functional requirements live in `plan/current/requirements/` as twelve discrete files, one per user story. This document carries the non-functional targets and the API/data summary only.

## Non-Functional Requirements

| ID | NFR | Target | Measurement |
|---|---|---|---|
| NFR-001 | Query latency | `/query` p95 remains under the existing 100 ms CI gate | Existing performance test, unchanged |
| NFR-002 | Boundary overhead | The four boundary checks add under 5 ms to p95 | Performance test comparison before/after; the checks are header string comparisons, so this is a ceiling not an estimate |
| NFR-003 | Crash resistance | **Zero** daemon process exits across a fuzz pass of malformed, oversized, chunked-oversized, forged-length and stalled requests | Regression test that issues the corpus and polls `GET /health` after each case |
| NFR-004 | Body cap | Requests above 4 MB refused with `413`; enforcement holds when `Content-Length` is absent or forged | Three separate integration tests (req-004) |
| NFR-005 | Request timeout | A connection that sends headers then stalls is closed within 30 s | Integration test with a deliberately stalled body |
| NFR-006 | Result bounding | `failure_sequence` and `drill_down` return at most `MAX_LIMIT` (1000) rows, matching the `event_log` precedent | Integration test asserting row count, `truncated`, and `total_count` |
| NFR-007 | Agent context bounding | Assembled MCP tool-result text stays under 100,000 characters | Integration test with an oversized result |
| NFR-008 | Error containment | **Zero** SQL fragments, engine strings, or stored values in any 4xx/5xx response body on any path | Regression test asserting the body matches none of `SELECT`, `FROM`, `LINE `, `Binder Error`, `Conversion Error`, or any value present in the events table |
| NFR-009 | Injection rejection | Every value in the req-009 corpus rejected before SQL construction, on both HTTP and MCP paths, with the events table unchanged | req-009 tests |
| NFR-010 | Render safety | No script execution from any telemetry field rendered in the log viewer, including the `title` attribute | Playwright behavioural assertions (req-010) |
| NFR-011 | CI budget | Combined suite stays inside the existing 5-minute CI budget (0000016 NFR-001) | CI wall-clock at P4 |
| NFR-012 | Backward compatibility | No existing successful response shape changes; `truncated` and `total_count` are additive | Existing test suite passes unmodified except where a test asserted the old error behaviour |

**Availability and scalability:** not separately targeted. This is a single-user local daemon; NFR-003 is the availability requirement in practice, and concurrency is a handful of local clients. Recorded here rather than left blank so the omission is visible as a decision.

## API Summary

Four endpoints, all on `127.0.0.1:<PORT>`. No endpoint is added or removed. The contract changes are new rejection paths and two additive response fields.

| Endpoint | Change |
|---|---|
| `GET /health` | Gains `Host` validation. Response body unchanged (`ok`, `version`, `buildId`) |
| `GET /ui` | Gains `Host` validation. Response unchanged |
| `POST /emit` | Gains `Host`, `Origin`, `Content-Type` and body-cap checks. Error bodies redacted and carry `correlationId`. Engine failures move from `400` to `500` |
| `POST /query` | As `/emit`, plus the shared validation gate (req-005) and bounded result sets on `failure_sequence` / `drill_down` (req-007) |

**New status codes:** `403` (Host/Origin refusal), `415` (wrong or missing Content-Type), `413` (body over cap), `500` (engine failure — previously misreported as `400`).

**Formal contract:** drafted at P1 to `plan/current/openapi-spec.yaml` (OpenAPI 3.1). This feature introduces it because the boundary contract is precisely what is being changed, and a language-agnostic statement of it is what P3, P4 and P5 verify against. `component.yml`'s `contract.apiSpec` previously read `"none"` and now points at the living docs path, marked pending until **P6 publishes the file there** — `plan/current/` archives at P7, so a contract must not point into an archive.

## Data Summary

**No schema change.** No column, table, index, or migration is added, altered, or dropped. `schemaVersion` stays `1.0` and `src/structured-telemetry-mcp/docs/data-contract.md` is unchanged by this feature.

Data ownership is unchanged: `structured-telemetry-mcp` remains sole owner of `~/.planifest/telemetry.db` (`events`).

Two data-adjacent behaviours change without touching the schema:

- **Read volume is bounded.** `failure_sequence` and `drill_down` stop materialising unbounded row sets (req-007).
- **Stored values stop leaking outward.** Error redaction (req-006) closes the path by which conversion errors returned real `session_id` values to callers. This is a confidentiality change to data already stored, not a change to what is stored.

## Sequencing

req-012 is fully independent and may land first or last. The remainder has one hard ordering constraint and one soft one:

1. **ADR-032 before req-001 and req-002** — hard. `breakingChangePolicy: requires-adr`.
2. **req-001 to req-004 as one integrated pass** — hard. All four edit the same request-entry path in `src/server-http.ts`; parallel edits clobber (R-002, precedent 0000017 R-002).
3. **req-005 before req-006's `400` path is meaningful** — soft. The redacted `400` needs the structured field errors the gate produces.
4. **req-007 before req-008** — soft. req-008's truncation notice reports `total_count`, which req-007 introduces.
5. **req-009 and req-010 before req-011** — hard. req-011 documents tests that must exist first.
