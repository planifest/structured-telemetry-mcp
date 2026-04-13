#!/usr/bin/env node
/**
 * structured-telemetry-mcp — MCP server entry point.
 *
 * Exposes two tools:
 *   emit_event      — ingests a validated telemetry event into DuckDB
 *   query_telemetry — runs structured queries and returns Markdown + JSON + raw sample
 *
 * Transport: stdio (ADR-003)
 * Storage:   DuckDB via @duckdb/node-api (ADR-002)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

import { validateEvent } from './validation/validate-event.js';
import { writeEvent } from './db/events-repository.js';
import { queryBottlenecks, type BottleneckQuery } from './query/bottlenecks.js';
import { queryFailures, type FailureQuery } from './query/failures.js';
import { queryTokenEfficiency, type TokenEfficiencyQuery } from './query/token-efficiency.js';

// ── Version ───────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const VERSION: string = (() => {
  for (const rel of ['../package.json', './package.json']) {
    const p = resolve(__dirname, rel);
    if (existsSync(p)) {
      try {
        return (JSON.parse(readFileSync(p, 'utf8')) as { version: string }).version;
      } catch { /* continue */ }
    }
  }
  return 'unknown';
})();

// ── Error handling ────────────────────────────────────────────────────────────

process.on('unhandledRejection', (err) => {
  process.stderr.write(`[structured-telemetry-mcp] unhandledRejection: ${err}\n`);
});
process.on('uncaughtException', (err: Error) => {
  process.stderr.write(`[structured-telemetry-mcp] uncaughtException: ${err?.message ?? err}\n`);
});

// ── Server ────────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'structured-telemetry-mcp',
  version: VERSION,
});

// ── emit_event tool (REQ-001) ─────────────────────────────────────────────────

server.tool(
  'emit_event',
  'Ingest a structured telemetry event into the Planifest telemetry store.',
  { event: z.unknown().describe('The telemetry event envelope. Must conform to schemas/telemetry-event.schema.json.') },
  async (args) => {
    const validation = validateEvent(args.event);

    if (!validation.isValid) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ ok: false, errors: validation.errors }),
          },
        ],
      };
    }

    // Safe to cast after validation.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await writeEvent(args.event as any);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result),
        },
      ],
    };
  },
);

// ── query_telemetry tool (REQ-002, REQ-003, REQ-004) ─────────────────────────

server.tool(
  'query_telemetry',
  'Query structured telemetry data. Returns Markdown table, JSON aggregation, and raw event sample.',
  { query: z.unknown().describe('Query parameters. See README for full schema.') },
  async (args) => {
    try {
      const q = args.query as Record<string, unknown>;
      const response = await dispatchQuery(q);

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
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ ok: false, errors: [`query error: ${err}`] }),
          },
        ],
      };
    }
  },
);

/** JSON replacer that converts BigInt (returned by DuckDB COUNT etc.) to Number. */
function bigIntReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? Number(value) : value;
}

/**
 * Dispatches a query object to the appropriate query module.
 * Determines the module based on the presence of discriminator fields.
 */
async function dispatchQuery(q: Record<string, unknown>) {
  // Failure / loop queries.
  if (typeof q['mode'] === 'string' &&
      ['retry_summary', 'loop_candidates', 'failure_sequence', 'failure_cluster'].includes(q['mode'])) {
    return queryFailures(q as unknown as FailureQuery);
  }

  // Token efficiency queries.
  if (typeof q['mode'] === 'string' &&
      ['context_pressure', 'mcp_impact', 'request_volume', 'trend', 'drill_down'].includes(q['mode'])) {
    return queryTokenEfficiency(q as unknown as TokenEfficiencyQuery);
  }

  // Bottleneck queries (group_by).
  if (typeof q['group_by'] === 'string') {
    return queryBottlenecks(q as unknown as BottleneckQuery);
  }

  throw new Error('Unrecognised query shape. Provide group_by or mode.');
}

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`[structured-telemetry-mcp] v${VERSION} ready (stdio)\n`);
