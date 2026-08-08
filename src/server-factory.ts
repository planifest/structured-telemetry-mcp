/**
 * Server factory — all tool handler logic lives here, injected with interfaces.
 * createEmitEventHandler, createQueryTelemetryHandler, and dispatchQuery are
 * exported so they can be unit-tested with mock implementations.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { validateEvent } from './validation/validate-event.js';
import { validateQuery } from './query/validate-query.js';
import type { IEventRepository } from './db/repository.js';
import type { IQueryService, BottleneckQuery, FailureQuery, TokenEfficiencyQuery, EventLogQuery, DistinctValuesQuery, QueryResponse } from './query/query-service.js';
import { BOTTLENECK_GROUP_BY_VALUES } from './query/bottlenecks.js';
import type { TelemetryEvent } from './types/events.js';

export type McpTextResult = { content: Array<{ type: 'text'; text: string }> };

// ── emit_event tool-argument schema (ADR-013) ──────────────────────────────────

/**
 * Mirrors schemas/telemetry-event.schema.json's top-level envelope shape.
 * This is an argument-shape gate for the emit_event MCP tool, not a
 * replacement for validateEvent()/ajv — ajv remains the source of truth for
 * cross-field rules on `data` (ADR-005). Giving the MCP tool a real Zod
 * object here (instead of z.unknown()) is what lets calling models see a
 * structural type: "object" schema with properties, per ADR-013.
 */
export const EmitEventEnvelope = z.object({
  schema_version: z.literal('1.0'),
  event: z.enum([
    'phase_start', 'phase_end', 'spec_gap', 'validation_failure', 'deviation',
    'migration_proposal', 'context_pressure', 'mcp_impact', 'self_correction',
    'phase_skip', 'security_finding', 'retry_limit_exceeded', 'adr_decision', 'doc_gap',
    'context_reset', 'approval_requested', 'fast_path_engaged', 'test_failure',
    'performance_regression', 'dependency_blocked', 'schema_migration_applied',
    'loop_iteration', 'phase_reversal_petitioned', 'phase_reversal_granted', 'phase_reversal_denied',
  ]),
  session_id: z.string().min(1),
  initiative_id: z.string().optional(),
  product_id: z.string().optional(),
  phase: z.enum(['orchestrator', 'spec', 'adr', 'codegen', 'validate', 'security', 'docs', 'change', 'ship']),
  agent: z.string().min(1),
  tool: z.string().min(1),
  model: z.string().min(1),
  mcp_mode: z.enum(['none', 'workspace', 'context', 'workspace+context']),
  timestamp: z.string(),
  model_config: z.record(z.string(), z.unknown()).optional(),
  data: z.record(z.string(), z.unknown()),
}).strict();

// ── query_telemetry tool-argument schema (ADR-015, extends ADR-013) ───────────

/**
 * Permissive object schema for the query_telemetry tool argument — fixes the
 * same R-009-class bug as EmitEventEnvelope (ADR-013), but scoped more loosely:
 * query shapes genuinely vary across the four query families, and dispatchQuery
 * already validates cross-field rules (unrecognised shape, missing session_id,
 * etc.) with clear thrown errors. This schema's only job is to guarantee the
 * argument actually arrives as an object — .passthrough() so it never rejects
 * a shape dispatchQuery would otherwise accept.
 */
export const QueryShape = z.object({
  group_by: z.string().optional(),
  mode: z.string().optional(),
  session_id: z.string().optional(),
  initiative_id: z.string().optional(),
  event_type: z.string().optional(),
  limit: z.number().optional(),
  loop_threshold: z.number().optional(),
}).passthrough();

// ── Dispatch ──────────────────────────────────────────────────────────────────

/**
 * Routes a raw query object to the correct IQueryService method.
 * Exported for unit testing. Throws for unrecognised shapes.
 */
export async function dispatchQuery(qs: IQueryService, q: Record<string, unknown>): Promise<QueryResponse> {
  // event_log is checked first — it uses `mode` but is its own query family (ADR-010).
  // No scope parameter is required (ADR-016, 0000015) — eventLog() bounds every
  // request by limit/offset alone and rejects pathological limit values itself.
  if (q['mode'] === 'event_log') {
    return qs.eventLog(q as unknown as EventLogQuery);
  }

  // distinct_values (req-002, 0000017): field-name validation against the
  // shared SUGGESTIBLE_FIELDS allow-list happens inside queryDistinctValues
  // itself (ADR-024), before any SQL is built — dispatchQuery only routes.
  if (q['mode'] === 'distinct_values') {
    return qs.distinctValues(q as unknown as DistinctValuesQuery);
  }

  if (
    typeof q['mode'] === 'string' &&
    ['retry_summary', 'loop_candidates', 'failure_sequence', 'failure_cluster'].includes(q['mode'])
  ) {
    // BUG-002 / BUG-003: session_id is required for modes that scope to a single session.
    if (q['mode'] === 'failure_sequence') {
      if (typeof q['session_id'] !== 'string' || q['session_id'] === '') {
        throw new Error('failure_sequence requires session_id');
      }
    }
    return qs.failures(q as unknown as FailureQuery);
  }

  if (
    typeof q['mode'] === 'string' &&
    ['context_pressure', 'mcp_impact', 'request_volume', 'trend', 'drill_down'].includes(q['mode'])
  ) {
    if (q['mode'] === 'drill_down') {
      if (typeof q['session_id'] !== 'string' || q['session_id'] === '') {
        throw new Error('drill_down requires session_id');
      }
    }
    return qs.tokenEfficiency(q as unknown as TokenEfficiencyQuery);
  }

  if (typeof q['group_by'] === 'string') {
    if (!(BOTTLENECK_GROUP_BY_VALUES as readonly string[]).includes(q['group_by'])) {
      throw new Error(
        `Invalid group_by: "${q['group_by']}". Valid values: ${BOTTLENECK_GROUP_BY_VALUES.join(', ')}`,
      );
    }
    return qs.bottlenecks(q as unknown as BottleneckQuery);
  }

  throw new Error('Unrecognised query shape. Provide group_by or mode.');
}

// ── Tool handlers ─────────────────────────────────────────────────────────────

/**
 * Returns the emit_event tool handler bound to the given repository.
 * Exported for unit testing.
 *
 * Argument named `envelope` (not `event`) to avoid colliding with the
 * envelope's own `event` discriminator field (ADR-013, req-012).
 */
export function createEmitEventHandler(
  repo: IEventRepository,
): (args: { envelope: unknown }) => Promise<McpTextResult> {
  return async (args) => {
    // Argument-shape gate (ADR-013): rejects a malformed envelope (string,
    // undefined, null, array, wrong nesting) with a specific Zod error
    // before validateEvent()/ajv ever runs.
    const shapeCheck = EmitEventEnvelope.safeParse(args.envelope);
    if (!shapeCheck.success) {
      const errors = shapeCheck.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, errors }) }],
      };
    }

    const validation = validateEvent(shapeCheck.data);

    if (!validation.isValid) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, errors: validation.errors }) }],
      };
    }

    const result = await repo.write(shapeCheck.data as unknown as TelemetryEvent);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result) }],
    };
  };
}

/**
 * Returns the query_telemetry tool handler bound to the given query service.
 * Exported for unit testing.
 */
export function createQueryTelemetryHandler(
  qs: IQueryService,
): (args: { query: unknown; budget?: number }) => Promise<McpTextResult> {
  return async (args) => {
    // Argument-shape gate (ADR-015): rejects a non-object query (string,
    // undefined, null, array) with a specific error before dispatchQuery
    // ever runs — same root cause as R-009/ADR-013, scoped permissively
    // since dispatchQuery remains the semantic validator for query shape.
    const shapeCheck = QueryShape.safeParse(args.query);
    if (!shapeCheck.success) {
      const errors = shapeCheck.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, errors }) }],
      };
    }

    const q = shapeCheck.data as Record<string, unknown>;

    // req-005: the shared validation gate — the SAME gate the HTTP path uses,
    // so the two paths can no longer disagree on what a valid query is. Runs
    // before dispatch; an out-of-range numeric field is rejected here with a
    // field-named error, never coerced.
    const gate = validateQuery(q);
    if (!gate.ok) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, errors: gate.errors }) }],
      };
    }

    try {
      const response = await dispatchQuery(qs, q);
      // req-008: cap the assembled text independently of req-007's row cap.
      const budget = typeof args.budget === 'number' ? args.budget : MCP_TEXT_BUDGET;
      return { content: [{ type: 'text' as const, text: assembleToolResultText(response, budget) }] };
    } catch (err) {
      // req-006: never surface the engine error — redact, log with a correlationId.
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(redactError(err)) }],
      };
    }
  };
}

function bigIntReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? Number(value) : value;
}

/**
 * req-008: character budget for assembled MCP tool-result text. An agent's
 * context window is a tighter constraint than the daemon's memory, and this is
 * independent of req-007's row cap — a result perfectly reasonable over HTTP can
 * still be too large to paste into a conversation. Overridable via env for tests.
 */
const MCP_TEXT_BUDGET = Number(process.env['PLANIFEST_MCP_TEXT_BUDGET'] ?? 100_000);

/**
 * req-006: redact an engine/internal error before it reaches a caller. DuckDB
 * binder errors embed SQL and conversion errors embed stored row values; neither
 * may leave the process. The full error and stack go to stderr against a
 * correlation id the caller also receives, so an operator can still trace it.
 */
function redactError(err: unknown): { ok: false; errors: string[]; correlationId: string } {
  const correlationId = randomUUID();
  process.stderr.write(`[telemetry-backend] query failed correlationId=${correlationId}: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  return { ok: false, errors: ['query failed'], correlationId };
}

/**
 * req-008: assemble the tool-result text within a character budget. Sections are
 * dropped from the least important end first — raw sample, then JSON payload —
 * keeping the markdown summary. A truncation notice (with total_count when the
 * mode supplies it) states plainly that dropping occurred. Every JSON block that
 * appears is complete, never cut mid-structure. A result that already fits is
 * returned byte-identical to the pre-0000019 output.
 */
function assembleToolResultText(response: QueryResponse, budget: number): string {
  const jsonBlock = '## JSON\n\n```json\n' + JSON.stringify(response.json, bigIntReplacer, 2) + '\n```';
  const sampleBlock = '## Raw Sample\n\n```json\n' + JSON.stringify(response.rawSample, bigIntReplacer, 2) + '\n```';
  const full = ['## Results\n', response.markdown, '\n' + jsonBlock, '\n' + sampleBlock].join('\n');
  if (full.length <= budget) return full;

  const totalCount = (response.json as Record<string, unknown> | null)?.['total_count'];
  const notice = `\n\n_Result truncated to fit the tool-result budget${typeof totalCount === 'number' ? ` (total_count: ${totalCount})` : ''}. Narrow the query — by session, mode, or a smaller limit — for a complete result._`;

  // Drop the raw sample first, then the JSON payload; markdown is kept last.
  const withoutSample = ['## Results\n', response.markdown, '\n' + jsonBlock].join('\n') + notice;
  if (withoutSample.length <= budget) return withoutSample;

  const markdownOnly = ['## Results\n', response.markdown].join('\n') + notice;
  if (markdownOnly.length <= budget) return markdownOnly;

  // Pathological: even the markdown summary exceeds the budget. Hard-truncate it,
  // leaving room for the notice, so the returned text is never over budget.
  const room = Math.max(0, budget - notice.length);
  return markdownOnly.slice(0, room) + notice;
}

// ── Server factory ────────────────────────────────────────────────────────────

/**
 * Assembles and returns a configured McpServer.
 * No side effects — does not connect to any transport.
 */
export function createServer(
  repo: IEventRepository,
  qs: IQueryService,
  version: string,
): McpServer {
  const server = new McpServer({ name: 'structured-telemetry-mcp', version });

  server.tool(
    'emit_event',
    'Ingest a structured telemetry event into the Planifest telemetry store. Pass the full event envelope as the `envelope` argument — it must be a JSON object (not a string) with the fields shown in this tool\'s schema.',
    { envelope: EmitEventEnvelope },
    createEmitEventHandler(repo),
  );

  server.tool(
    'query_telemetry',
    'Query structured telemetry data. Returns Markdown table, JSON aggregation, and raw event sample. Pass `query` as a JSON object (not a string) — see README for the full field reference.',
    { query: QueryShape },
    createQueryTelemetryHandler(qs),
  );

  return server;
}
