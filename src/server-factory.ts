/**
 * Server factory — all tool handler logic lives here, injected with interfaces.
 * createEmitEventHandler, createQueryTelemetryHandler, and dispatchQuery are
 * exported so they can be unit-tested with mock implementations.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { validateEvent } from './validation/validate-event.js';
import type { IEventRepository } from './db/repository.js';
import type { IQueryService, BottleneckQuery, FailureQuery, TokenEfficiencyQuery, QueryResponse } from './query/query-service.js';
import type { TelemetryEvent } from './types/events.js';

export type McpTextResult = { content: Array<{ type: 'text'; text: string }> };

// ── Dispatch ──────────────────────────────────────────────────────────────────

/**
 * Routes a raw query object to the correct IQueryService method.
 * Exported for unit testing. Throws for unrecognised shapes.
 */
export async function dispatchQuery(qs: IQueryService, q: Record<string, unknown>): Promise<QueryResponse> {
  if (
    typeof q['mode'] === 'string' &&
    ['retry_summary', 'loop_candidates', 'failure_sequence', 'failure_cluster'].includes(q['mode'])
  ) {
    return qs.failures(q as unknown as FailureQuery);
  }

  if (
    typeof q['mode'] === 'string' &&
    ['context_pressure', 'mcp_impact', 'request_volume', 'trend', 'drill_down'].includes(q['mode'])
  ) {
    return qs.tokenEfficiency(q as unknown as TokenEfficiencyQuery);
  }

  if (typeof q['group_by'] === 'string') {
    return qs.bottlenecks(q as unknown as BottleneckQuery);
  }

  throw new Error('Unrecognised query shape. Provide group_by or mode.');
}

// ── Tool handlers ─────────────────────────────────────────────────────────────

/**
 * Returns the emit_event tool handler bound to the given repository.
 * Exported for unit testing.
 */
export function createEmitEventHandler(
  repo: IEventRepository,
): (args: { event: unknown }) => Promise<McpTextResult> {
  return async (args) => {
    const validation = validateEvent(args.event);

    if (!validation.isValid) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, errors: validation.errors }) }],
      };
    }

    const result = await repo.write(args.event as TelemetryEvent);
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
): (args: { query: unknown }) => Promise<McpTextResult> {
  return async (args) => {
    try {
      const q = args.query as Record<string, unknown>;
      const response = await dispatchQuery(qs, q);

      const text = [
        '## Results\n',
        response.markdown,
        '\n## JSON\n',
        '```json\n' + JSON.stringify(response.json, bigIntReplacer, 2) + '\n```',
        '\n## Raw Sample\n',
        '```json\n' + JSON.stringify(response.rawSample, bigIntReplacer, 2) + '\n```',
      ].join('\n');

      return { content: [{ type: 'text' as const, text }] };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, errors: [`query error: ${err}`] }) }],
      };
    }
  };
}

function bigIntReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? Number(value) : value;
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
    'Ingest a structured telemetry event into the Planifest telemetry store.',
    { event: z.unknown().describe('The telemetry event envelope. Must conform to schemas/telemetry-event.schema.json.') },
    createEmitEventHandler(repo),
  );

  server.tool(
    'query_telemetry',
    'Query structured telemetry data. Returns Markdown table, JSON aggregation, and raw event sample.',
    { query: z.unknown().describe('Query parameters. See README for full schema.') },
    createQueryTelemetryHandler(qs),
  );

  return server;
}
