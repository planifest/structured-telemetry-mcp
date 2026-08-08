# API Index

> Living document. Index of all public API endpoints across all components.
> Updated after every pipeline run — do not archive.

Last updated: 0000019-loopback-daemon-hardening

---

## MCP Tools

The primary interface. Registered by `src/server-factory.ts`'s `createServer()`.

| Tool | Argument | Component | Description | Auth |
|------|----------|-----------|-------------|------|
| `emit_event` | `envelope` (object, `EmitEventEnvelope` Zod schema — renamed from `event` in 0.10.0, ADR-013) | structured-telemetry-mcp | Ingests a validated telemetry event envelope; returns `{ ok, id }` or `{ ok: false, errors }` | none — bound to `127.0.0.1`, no auth model (ADR-005 trust boundary) |
| `query_telemetry` | `query` (object, permissive `QueryShape` Zod schema — real object schema as of 0.10.1, ADR-015, was `z.unknown()`) | structured-telemetry-mcp | Runs a structured query (bottlenecks, failures, token efficiency, event_log, distinct_values); returns Markdown + JSON + raw sample. `event_log` no longer requires a scope filter as of 0000015 (ADR-016) and gained `offset`/`sort`/`phase`/`agent`/`product_id`/`from`/`to`, plus `sortField` as of 0000017 (ADR-025 — allow-listed: `timestamp`, `event`, `session_id`, `phase`, `agent`, `product_id`; defaults to `timestamp`, non-breaking). New `distinct_values` mode as of 0000017 (ADR-026) — `{ mode: 'distinct_values', field, q?, limit? }`, `field` allow-listed against `session_id`, `initiative_id`, `event`, `phase`, `agent`, `product_id`; returns up to 20 distinct non-null values, optionally prefix-filtered by `q` | none |

## HTTP REST Endpoints (local backend only, `127.0.0.1:3741`)

| Method | Path | Component | Description | Auth |
|--------|------|-----------|-------------|------|
| POST | `/emit` | structured-telemetry-mcp | HTTP equivalent of `emit_event`, used by the stdio proxy (ADR-009) and directly by scripts/CI. As of 0000019: requires `Content-Type: application/json` (`415` otherwise), body capped at `PLANIFEST_MAX_BODY_BYTES` (`413`), engine failures redacted to a `500` + `correlationId` (was a `400` leaking raw DuckDB text) | none (provenance-checked, ADR-032) |
| POST | `/query` | structured-telemetry-mcp | HTTP equivalent of `query_telemetry`. As of 0000019: same `Content-Type`/body-cap/redaction rules as `/emit`, plus the shared validation gate (`src/query/validate-query.ts`) rejecting non-integer/over-ceiling `limit`/`offset`/`loop_threshold` with a `400` | none (provenance-checked, ADR-032) |
| GET | `/health` | structured-telemetry-mcp | Liveness check — used by the macOS/Linux/Windows service scripts (0000010) to verify a successful install/restart. As of 0000018, gains an additive `buildId` field (SHA-256 of `server-http.bundle.mjs`, `null` if the bundle can't be found) — `scripts/service-manager.mjs`'s `deploy` action compares this against a freshly-computed hash to catch a stale running daemon even at an unchanged `version` string (req-008, ADR-030 context). Existing `{ ok, version }` shape unchanged for callers not reading the new field. | none |
| GET | `/ui` | structured-telemetry-mcp | Serves the static Log Viewer browser page (0000015, ADR-018) — calls `POST /query` (`event_log` and, as of 0000017, `distinct_values` modes) via same-origin `fetch()`. As of 0000017: live auto-refresh/tail mode (5s polling), per-field filter-value suggestion comboboxes, and sortable table column headers (three-way synced with the sort control and URL query params) | none |

**Auth is `none` in the credential sense** — no token, password, or key — because the backend is bound to `127.0.0.1` only, never exposed to the network. This is the trust boundary established in `0000008-mcp-server-foundation`, re-confirmed unchanged in `0000010-macos-launchd-service`'s security report (`plan/_archive/0000010-macos-launchd-service-2026-07-19/security-report.md`), and re-confirmed again in `0000015-telemetry-log-viewer-ui`'s security report (`plan/_archive/0000015-telemetry-log-viewer-ui-2026-08-01/security-report.md`) when the new `GET /ui` route and the `event_log` scope-filter relaxation were reviewed.

As of 0000019 (ADR-032), that `127.0.0.1` binding is no longer the only defence: the daemon also checks caller **provenance** on every request — a `Host` allow-list and `Origin` rejection (before routing), plus a `Content-Type: application/json` requirement on writes — closing a browser-mediated CSRF-write and DNS-rebinding-read surface that `127.0.0.1` binding alone does not (the developer's own browser sits inside that boundary). A shared secret was deliberately **not** added; see ADR-032's Alternatives table. Still no credential — what changed is that where a request comes from is now checked.

---

## Versioning Strategy

The event envelope carries its own `schema_version` field (currently `"1.0"`) — additive changes (new event types, new optional fields) do not increment it. The `emit_event` tool *argument* shape is versioned via the package's own semver (breaking argument-shape changes, like the 0.10.0 `event`→`envelope` rename, bump the minor version and are called out in the changelog and README).

---

## Full Specifications

| Component | Schema / Spec |
|-----------|---------------|
| structured-telemetry-mcp | `schemas/telemetry-event.schema.json` (event envelope + `data` payload shapes, source of truth per ADR-005) |
| structured-telemetry-mcp | `src/structured-telemetry-mcp/docs/openapi-spec.yaml` (OpenAPI 3.1 — the HTTP surface's request-boundary and error contract, new in 0000019) |

An OpenAPI spec for the REST endpoints now exists — `src/structured-telemetry-mcp/docs/openapi-spec.yaml`, introduced by 0000019. It pins exactly what that feature changed: the request boundary (which requests are refused, and with what status — `403`/`415`/`413`/`500`) and the error contract (what an error body may contain). It adds or removes no endpoint. `docs/usage-guide.md` §3–4 remains the human-readable companion.

All four HTTP endpoints above (`/emit`, `/query`, `/health`, `/ui`) gained black-box E2E test coverage as of 0000016 — see `tests/e2e/backend/` and `tests/e2e/ui/`. No endpoint shape or contract changed; test coverage only.

As of 0000017, `/query`'s `event_log` mode gained an additive `sortField` param and a new `distinct_values` mode was added (both reached through the same existing endpoint, ADR-026 — no new route). `/ui` gained auto-refresh, filter-value suggestions, and sortable headers. Both extensions gained E2E coverage in the same suites (`tests/e2e/ui/log-viewer.spec.ts`).

As of 0000019, no route was added or removed; the request **boundary** was hardened (Host/Origin/Content-Type checks, a two-point body cap, a request timeout, and error redaction with a `correlationId`) and captured in the new OpenAPI spec above. `distinct_values`' `limit` changed from a silent clamp to a reject over its ceiling of 20, and `failure_sequence`/`drill_down` responses gained additive `truncated`/`total_count` fields. All of it gained injection and XSS-escaping test coverage, each verified with a RED-before-GREEN weakening cycle (req-009/010).

---

*Template: api-index.template.md*
