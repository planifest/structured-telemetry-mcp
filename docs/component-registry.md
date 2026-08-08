# Component Registry

> Living document. Index of every component in this repository. Updated after every pipeline run.
> Do not archive this file — update it in place.

Last updated: 0000019-loopback-daemon-hardening

---

## Components

| Component | Type | Purpose | Status |
|-----------|------|---------|--------|
| [structured-telemetry-mcp](../src/structured-telemetry-mcp/docs/purpose.md) | microservice | MCP server that ingests and queries structured telemetry events from Planifest pipeline runs, runs as a background service on Windows/macOS/Linux, serves a read-only browser log-viewer UI (0000015), guarantees its own record is durable (0000018 — verified backups, crash-safe checkpointing, refuse-to-start on a corrupt store, deploy build-identity verification), and (as of 0000019) hardens its loopback HTTP request boundary — caller-provenance checks, a request-body cap, request timeout, a shared query-validation gate, and redacted engine errors | active |

This is a single-component repository — one microservice, no shared packages. It gained its first frontend surface in 0000015 (a static, dependency-free UI served in-process — not a separate frontend component). As of 0000016, its HTTP/browser surface (`/emit`, `/query`, `/health`, `/ui`) gained true black-box E2E test coverage (`@playwright/test`, `tests/e2e/`) — test infrastructure, not a new component. As of 0000018, it also owns a second on-disk data location (`~/.planifest-backups` by default) for verified backup artifacts — still the same component, no new component boundary, per ADR-029. As of 0000019, the HTTP surface gained its first formal OpenAPI contract (`src/structured-telemetry-mcp/docs/openapi-spec.yaml`) — the request boundary was hardened, but no route was added or removed and no component boundary changed. Version 0.15.0.

---

*Template: component-registry (see architecture-overview.template.md for related living-doc conventions)*
