---
title: "Execution Plan: 0000008-structured-telemetry-mcp-server"
status: "draft"
version: "0.1.0"
feature: "0000008-structured-telemetry-mcp-server"
---

# Execution Plan - 0000008-structured-telemetry-mcp-server

## Overview

Build a standalone MCP server that provides structured telemetry ingestion and querying for Planifest pipeline runs. The server exposes two MCP tools — `emit_event` and `query_telemetry` — backed by a DuckDB store with JSON Schema validation at the point of ingestion.

**Component:** `structured-telemetry-mcp`
**Adoption mode:** greenfield
**Confirmed design:** `plan/current/design.md`

## Functional Requirements

Derived from user stories S1, S2, S3. Full detail in `plan/current/requirements/`.

| Req ID | Slug | Story | Summary |
|--------|------|-------|---------|
| REQ-001 | emit-event | S1, S2, S3 | MCP tool that ingests a validated telemetry event into DuckDB |
| REQ-002 | query-bottlenecks | S1 | Query interface for phase/agent/tool/content-format duration metrics |
| REQ-003 | query-failures | S2 | Query interface for retry instances, pass/fail rates, failure sequences |
| REQ-004 | query-token-efficiency | S3 | Query interface for context pressure and request volume metrics |
| REQ-005 | schema-validation | S1, S2, S3 | JSON Schema validation of all events at ingestion |
| REQ-006 | performance | S1, S2, S3 | emit_event p95 < 5ms; avg latency measured and reported |
| REQ-007 | setup-cli | S1, S2, S3 | Setup, doctor, postinstall scripts; build and bundle pipeline |

## Non-Functional Requirements

| ID | Category | Requirement | Target | Measurement |
|----|----------|------------|--------|-------------|
| NFR-001 | Performance | emit_event p95 latency | < 5ms | Vitest performance test; avg reported in test output |
| NFR-002 | Scalability | DuckDB query time on large store | No degradation up to 10M rows | Benchmark test at 1M, 5M, 10M rows |
| NFR-003 | Code quality | Google TypeScript Style Guide | Zero violations | tsc + eslint in CI |
| NFR-004 | Reliability | CI matrix | Pass on Windows, macOS, Linux | GitHub Actions matrix |
| NFR-005 | Build | Bundle size | Single `server.bundle.mjs` runnable without install | esbuild bundle check |

## MCP Tool Summary

This component is an MCP server, not an HTTP API. No OpenAPI specification applies. Tool contracts are defined in the data contract and domain glossary.

| Tool | Direction | Description |
|------|-----------|-------------|
| `emit_event` | Input | Accepts a telemetry event envelope, validates against schema, writes to DuckDB |
| `query_telemetry` | Output | Accepts a structured query, reads from DuckDB, returns Markdown table + JSON + raw event sample |

## Data Model Summary

| Entity | Owner Component | Key Fields | Relationships |
|--------|----------------|------------|---------------|
| `TelemetryEvent` | structured-telemetry-mcp | schema_version, event, session_id, initiative_id, phase, agent, tool, model, mcp_mode, timestamp, data | Self-contained; no foreign keys |

Full schema in `src/structured-telemetry-mcp/docs/data-contract.md`.

## Build and Scripts

Modelled on context-mode-mcp.

| Script | Command | Purpose |
|--------|---------|---------|
| `build` | `tsc && npm run bundle` | Compile TypeScript and bundle |
| `bundle` | `esbuild src/server.ts ... → server.bundle.mjs` | Single-file bundle for distribution |
| `dev` | `npx tsx src/server.ts` | Local development server |
| `setup` | `npx tsx src/cli.ts setup` | Register MCP server in agent tool config |
| `doctor` | `npx tsx src/cli.ts doctor` | Diagnose configuration and connectivity |
| `postinstall` | `node scripts/postinstall.mjs` | Auto-run on npm install |
| `typecheck` | `tsc --noEmit` | Type check without emit |
| `test` | `vitest run` | Run all tests including performance test |

## Assumptions

| ID | Assumption | Impact if Wrong |
|----|-----------|----------------|
| A-001 | DuckDB npm package installs cleanly on Windows, macOS, Linux | Storage layer blocked; would require SQLite fallback |
| A-002 | stdio transport is sufficient for local dev use | HTTP/SSE transport layer required |
| A-003 | Event payloads do not contain credentials or secrets | Encryption at rest required |
| A-004 | `@duckdb/node-api` is used over legacy `duckdb` package for Node 18+ compatibility | May need to switch package if API is unstable |
