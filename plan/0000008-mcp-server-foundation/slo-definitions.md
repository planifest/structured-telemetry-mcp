---
title: "SLO Definitions: 0000008-structured-telemetry-mcp-server"
version: "0.1.0"
feature: "0000008-structured-telemetry-mcp-server"
---

# SLO Definitions - 0000008-structured-telemetry-mcp-server

## Applicability

This is a local developer tool with no network exposure and no production SLO. The targets below are engineering quality gates enforced in CI, not operational commitments.

## SLIs and Targets

| SLI | Target | Enforcement |
|-----|--------|-------------|
| `emit_event` p95 write latency | < 5ms | CI fails if exceeded (Vitest performance test) |
| `emit_event` avg write latency | Measured and reported | Informational; printed to test output |
| CI pass rate (typecheck + test + build) | 100% on merge to main | GitHub Actions required checks |
| Platform compatibility | Passes on Windows, macOS, Linux | GitHub Actions matrix |
| DuckDB query latency at 1M rows | < 500ms p95 | Informational benchmark (does not fail CI) |
| DuckDB query latency at 10M rows | < 2000ms p95 | Informational benchmark (does not fail CI) |

## Error Budget

Not applicable for a local tool. The CI gate for `emit_event` p95 < 5ms acts as the primary quality signal.
