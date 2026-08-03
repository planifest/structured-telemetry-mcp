# Interface Contract — structured-telemetry-mcp

See `docs/api-index.md` at the repo root for the full endpoint/tool table. This file covers the contract in more depth for implementers.

## `emit_event` (MCP tool)

**Argument:** `envelope` (object) — renamed from `event` in 0.10.0 (ADR-013) to avoid colliding with the envelope's own `event` discriminator field.

**Argument schema:** `EmitEventEnvelope` (exported from `src/server-factory.ts`) — a `.strict()` Zod object mirroring `schemas/telemetry-event.schema.json`'s top-level shape. This is a shape gate only; it does not replace `validateEvent()`/ajv, which remains the source of truth for `data` payload cross-field rules (ADR-005, ADR-013).

**Response:**
- Success: `{ "ok": true, "id": "<uuid>" }`
- Validation failure (Zod shape gate or ajv/cross-field): `{ "ok": false, "errors": ["<message>", ...] }`
- A thrown error from the storage layer (e.g. DB connection lost) propagates as a rejected promise — the handler does not catch storage errors itself.

**Breaking-change policy:** `requires-adr` (per `component.yml`'s `contract.breakingChangePolicy`). The 0.10.0 `event`→`envelope` rename is exactly such a change, recorded in ADR-013.

## `query_telemetry` (MCP tool)

**Argument:** `query` (object). See `docs/usage-guide.md` §7 for the full query shape reference (bottleneck / failure / token-efficiency / event_log / distinct_values query families). As of 0000015 (ADR-016), the `event_log` family no longer requires a scope filter — every request is bounded solely by `limit`/`offset` — and gained `phase`/`agent`/`product_id`/`from`/`to`/`sort` parameters plus a `total_count` field in the response. As of 0000017 (ADR-025), `event_log` also accepts an optional `sortField` param — allow-listed to `timestamp`, `event`, `session_id`, `phase`, `agent`, `product_id` (`SORTABLE_FIELDS`, ADR-024) — defaulting to `timestamp` when omitted, so existing callers are unaffected.

**Response:** formatted text with three sections — `## Results` (Markdown table), `## JSON` (aggregation), `## Raw Sample` (up to 5 raw events).

### `distinct_values` mode (0000017, ADR-026)

A fifth query family reached through the same `mode`-keyed dispatch as `event_log`/bottleneck/failure/token-efficiency — no new HTTP route.

**Request:** `{ mode: 'distinct_values', field: <allow-listed field name>, q?: <prefix string> }` — `field` must be one of `SUGGESTIBLE_FIELDS` (`session_id`, `initiative_id`, `event`, `phase`, `agent`, `product_id` — ADR-024); an unrecognized field throws a clear error before any SQL executes, never silently ignored.

**Response:** up to 20 distinct values for the requested field, optionally prefix-filtered by `q` — used to populate the Log Viewer's filter-combobox suggestions.

## REST equivalents

`POST /emit` and `POST /query` on the local HTTP backend (`127.0.0.1:3741`) mirror the two MCP tools — used by the stdio proxy (ADR-009) and directly by scripts/CI. `GET /health` is a liveness check, used by all three platforms' service scripts to verify a successful install/restart. `GET /ui` (0000015, ADR-018) serves the static Log Viewer browser page from the same process; the page itself calls `POST /query` via same-origin `fetch()`, not a separate contract.

As of 0000016, all four routes above have black-box E2E coverage (`tests/e2e/backend/`, `tests/e2e/ui/`, `@playwright/test`) exercising the real `node:http` server, not just these exported handlers — see ADR-020 through ADR-023.

## Consumers

`contract.consumedBy` in `component.yml` is empty by design (spec-agent convention — unknown at requirements phase). In practice, the known consumer is `planifest-framework` (sibling repo), calling `emit_event`/`query_telemetry` from its own skills. No code-level dependency exists between the repos — only the shared tool-call contract and `schemas/telemetry-event.schema.json`.
