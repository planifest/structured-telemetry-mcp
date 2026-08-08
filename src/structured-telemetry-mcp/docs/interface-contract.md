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

`POST /emit` and `POST /query` on the local HTTP backend (`127.0.0.1:3741`) mirror the two MCP tools — used by the stdio proxy (ADR-009) and directly by scripts/CI. `GET /health` is a liveness check, used by all three platforms' service scripts to verify a successful install/restart. As of 0000018, `GET /health` gains an additive `buildId` field (SHA-256 of `server-http.bundle.mjs`, `null` if the bundle can't be found — e.g. running under `tsx` in dev) — `scripts/service-manager.mjs`'s `deploy` action compares this against a freshly-computed hash of the just-built bundle to catch a stale running daemon even at an unchanged `version` string (req-008). The existing `{ ok, version }` shape is unchanged for any consumer not reading the new field. `GET /ui` (0000015, ADR-018) serves the static Log Viewer browser page from the same process; the page itself calls `POST /query` via same-origin `fetch()`, not a separate contract.

As of 0000016, all four routes above have black-box E2E coverage (`tests/e2e/backend/`, `tests/e2e/ui/`, `@playwright/test`) exercising the real `node:http` server, not just these exported handlers — see ADR-020 through ADR-023.

### Request boundary and error contract (0000019, ADR-032)

The HTTP surface now has a formal OpenAPI 3.1 contract at `docs/openapi-spec.yaml` (sibling to this file). No route was added or removed; what 0000019 pins is the request boundary and the error contract:

- **Provenance checks, before routing and before the body is read.** A `Host` allow-list (`127.0.0.1:<port>` / `localhost:<port>`, compared against the *actually-bound* port from `server.address()`, not the configured `PORT` — so the ephemeral-port E2E harness is not locked out) and an `Origin` rejection (a foreign `Origin` is refused; **no** `Origin` is accepted, because the stdio proxy and emission hooks send none). Both refuse with `403`, which carries no `correlationId` since nothing executed. No `Access-Control-Allow-Origin` is ever emitted — cross-origin access is refused, not negotiated.
- **`Content-Type: application/json` required on `POST /emit` and `POST /query`** (`415` otherwise) — closes the CORS-simple no-preflight write path.
- **Two-point body cap** at `PLANIFEST_MAX_BODY_BYTES` (default 4 MB): a `Content-Length` pre-check plus a streaming byte counter (the load-bearing one against a chunked or forged-length request) → `413`. `readBody`'s over-cap handling differs by delivery shape — an honest over-cap `Content-Length` rejects without destroying the socket (so a `413` can be sent), while a streaming overflow calls `req.destroy()`.
- **Request timeout** (`PLANIFEST_REQUEST_TIMEOUT_MS`, default 30 s) closes a connection that sends headers then stalls — a transport-level outcome, no status code.
- **Error redaction.** Engine/internal failures return a generic `500` + `correlationId`; the full error and stack go to stderr against the same id. This replaces the pre-0000019 `400` responses that interpolated raw DuckDB text and stored row values. `400` is now reserved for validated client input (the shared `src/query/validate-query.ts` gate — see `usage-guide.md` §7). The same redaction was applied to the MCP result path in `src/server-factory.ts`, not just the two HTTP sites.
- **Crash safety.** A try/catch around the `readBody` end-listener rejects the promise on a throw instead of letting it reach `uncaughtException -> process.exit(1)` — so a single malformed request can no longer terminate the daemon.

No credential is added (ADR-032 deliberately rejects a shared secret). `component.yml`'s `breakingChangePolicy` is `requires-adr`; ADR-032 is that ADR, narrowing the earlier "no auth model required" claim to "no credential, but caller provenance is checked."

## Consumers

`contract.consumedBy` in `component.yml` is empty by design (spec-agent convention — unknown at requirements phase). In practice, the known consumer is `planifest-framework` (sibling repo), calling `emit_event`/`query_telemetry` from its own skills. No code-level dependency exists between the repos — only the shared tool-call contract and `schemas/telemetry-event.schema.json`.
