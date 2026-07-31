/**
 * Formats query results as Markdown table, JSON payload, and raw event sample.
 * All query_telemetry responses include all three formats (REQ-002/003/004).
 */

import type { DuckDBConnection } from '@duckdb/node-api';

export interface QueryResponse {
  readonly markdown: string;
  readonly json: object;
  readonly rawSample: readonly object[];
}

/** Renders a Markdown table from headers and rows. */
export function renderMarkdownTable(headers: readonly string[], rows: readonly (string | number | null)[][], hint?: string): string {
  if (rows.length === 0) return hint ? `_No results._ ${hint}\n` : '_No results._\n';

  const headerRow = `| ${headers.join(' | ')} |`;
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  const dataRows = rows.map((row) => `| ${row.map((cell) => String(cell ?? '')).join(' | ')} |`);

  return [headerRow, separator, ...dataRows].join('\n') + '\n';
}

/** Wraps aggregation results and raw sample into the standard response shape. */
export function buildQueryResponse(
  headers: readonly string[],
  rows: readonly (string | number | null)[][],
  rawSample: readonly object[],
  aggregation: object,
  hint?: string,
): QueryResponse {
  return {
    markdown: renderMarkdownTable(headers, rows, hint),
    json: hint ? { ...aggregation, hint } : aggregation,
    rawSample,
  };
}

/**
 * When a scoped query (session_id/initiative_id) matches zero rows for its
 * event-type/family, this is indistinguishable from "no data exists for this
 * scope at all" — even when real events exist under a different event type.
 * Only call this on the zero-row path; it costs one extra indexed lookup.
 * Returns undefined if unscoped or if nothing exists for the scope either way.
 */
export async function buildScopeHint(
  conn: DuckDBConnection,
  scope: { session_id?: string; initiative_id?: string },
): Promise<string | undefined> {
  const clauses: string[] = [];
  const params: Record<string, string> = {};
  if (scope.session_id) {
    clauses.push('session_id = $session_id');
    params['session_id'] = scope.session_id;
  }
  if (scope.initiative_id) {
    clauses.push('initiative_id = $initiative_id');
    params['initiative_id'] = scope.initiative_id;
  }
  if (clauses.length === 0) return undefined;

  const sql = `
    SELECT event, COUNT(*) AS event_count
    FROM events
    WHERE ${clauses.join(' AND ')}
    GROUP BY event
    ORDER BY event_count DESC
    LIMIT 5
  `;
  const stmt = await conn.prepare(sql);
  await stmt.bind(params);
  const result = await stmt.runAndReadAll();
  const rows = result.getRows() as [string, bigint | number][];
  if (rows.length === 0) return undefined;

  const summary = rows.map(([event, count]) => `${event} (${count})`).join(', ');
  return `No matching events for this query, but found other event types for this scope: ${summary}.`;
}
