---
title: "Requirement: REQ-006 - performance"
summary: "emit_event p95 latency < 5ms; avg latency measured and reported in performance tests."
status: "active"
version: "0.1.0"
feature: "0000008-structured-telemetry-mcp-server"
stories: ["S1", "S2", "S3"]
---

# REQ-006 — Performance

## Description

`emit_event` must not noticeably impact agent session performance. The p95 write latency target is < 5ms measured from tool invocation to confirmation response. Average latency must be measured and reported in test output so it can be tracked across versions.

## Targets

| Metric | Target | Measurement method |
|--------|--------|--------------------|
| `emit_event` p95 latency | < 5ms | Vitest performance test: 1000 sequential writes, report p50/p95/p99/avg |
| `emit_event` avg latency | Measure and report | Printed in test output; no pass/fail threshold |
| `query_telemetry` p95 latency (1M rows) | < 500ms | Benchmark test at 1M row store |
| `query_telemetry` p95 latency (10M rows) | < 2000ms | Benchmark test at 10M row store |
| DuckDB file size (1M events) | < 500MB | Reported in benchmark output |

## Test Requirements

- Vitest performance test at `tests/performance.test.ts`:
  - Seeds DuckDB with 1000 events.
  - Measures p50, p95, p99, avg write latency over 1000 sequential `emit_event` calls.
  - Prints a human-readable summary to stdout.
  - Fails CI if p95 > 5ms.
- Benchmark test at `tests/benchmark.ts`:
  - Seeds DuckDB with 1M and 10M rows.
  - Measures query latency for each REQ-002/003/004 query mode.
  - Prints results to stdout. Does not fail CI (informational only).

## DuckDB Configuration

- WAL (Write-Ahead Log) mode enabled for concurrent read safety.
- Single-writer architecture: all writes go through the MCP server process.
- No connection pooling required (single process, single connection).

## Acceptance Criteria

- [ ] Vitest performance test exists and runs in CI.
- [ ] CI fails if `emit_event` p95 > 5ms.
- [ ] Avg latency is printed to test output on every run.
- [ ] Benchmark tests exist and report query latency at 1M and 10M rows.
- [ ] DuckDB is configured with WAL mode.
