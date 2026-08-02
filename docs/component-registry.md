# Component Registry

> Living document. Index of every component in this repository. Updated after every pipeline run.
> Do not archive this file — update it in place.

Last updated: 0000016-e2e-playwright-test-suites

---

## Components

| Component | Type | Purpose | Status |
|-----------|------|---------|--------|
| [structured-telemetry-mcp](../src/structured-telemetry-mcp/docs/purpose.md) | microservice | MCP server that ingests and queries structured telemetry events from Planifest pipeline runs, runs as a background service on Windows/macOS/Linux, and (as of 0000015) serves a read-only browser log-viewer UI | active |

This is a single-component repository — one microservice, no shared packages. It gained its first frontend surface in 0000015 (a static, dependency-free UI served in-process — not a separate frontend component). As of 0000016, its HTTP/browser surface (`/emit`, `/query`, `/health`, `/ui`) gained true black-box E2E test coverage (`@playwright/test`, `tests/e2e/`) — test infrastructure, not a new component.

---

*Template: component-registry (see architecture-overview.template.md for related living-doc conventions)*
