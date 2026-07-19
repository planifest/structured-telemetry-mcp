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

**Argument:** `query` (object) — unchanged by this feature. See `docs/usage-guide.md` §7 for the full query shape reference (bottleneck / failure / token-efficiency / event_log query families).

**Response:** formatted text with three sections — `## Results` (Markdown table), `## JSON` (aggregation), `## Raw Sample` (up to 5 raw events).

## REST equivalents

`POST /emit` and `POST /query` on the local HTTP backend (`127.0.0.1:3741`) mirror the two MCP tools — used by the stdio proxy (ADR-009) and directly by scripts/CI. `GET /health` is a liveness check, used by all three platforms' service scripts to verify a successful install/restart.

## Consumers

`contract.consumedBy` in `component.yml` is empty by design (spec-agent convention — unknown at requirements phase). In practice, the known consumer is `planifest-framework` (sibling repo), calling `emit_event`/`query_telemetry` from its own skills. No code-level dependency exists between the repos — only the shared tool-call contract and `schemas/telemetry-event.schema.json`.
