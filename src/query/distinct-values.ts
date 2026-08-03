/**
 * Query builder for req-002-filter-combobox-suggestions (0000017) — the
 * `distinct_values` query mode used to populate filter-field `<datalist>`
 * suggestions (ADR-026: a mode on the existing POST /query dispatch, not a
 * new route).
 *
 * `field` is a client-supplied string; DuckDB has no parameterized-identifier
 * binding for the SELECT DISTINCT column position, so `field` is validated
 * against the shared SUGGESTIBLE_FIELDS allow-list (ADR-024) before any SQL
 * is built, and only the resolved column name is ever interpolated — never
 * the client-supplied string itself. `q` (the typed prefix) is always bound
 * as a SQL parameter, never string-concatenated into the query text.
 */

import type { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import { buildQueryResponse, type QueryResponse } from './format-results.js';
import { ALLOWED_EVENT_COLUMNS, SUGGESTIBLE_FIELDS, type AllowedEventColumnKey } from './column-allow-list.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 20;
const MAX_Q_LENGTH = 200;

export interface DistinctValuesQuery {
  readonly mode: 'distinct_values';
  readonly field: string;
  readonly q?: string;
  readonly limit?: number;
}

/** Returns up to `limit` (default/max 20) distinct non-null values for an allow-listed field. */
export async function queryDistinctValues(db: DuckDBInstance, query: DistinctValuesQuery): Promise<QueryResponse> {
  if (!(SUGGESTIBLE_FIELDS as readonly string[]).includes(query.field)) {
    throw new Error(
      `Invalid field: "${query.field}". Valid values: ${SUGGESTIBLE_FIELDS.join(', ')}`,
    );
  }
  const column = ALLOWED_EVENT_COLUMNS[query.field as AllowedEventColumnKey];

  const limit = Math.min(Math.max(1, Number(query.limit ?? DEFAULT_LIMIT)), MAX_LIMIT);

  const conn = await db.connect();
  try {
    const params: Record<string, string> = {};
    let prefixClause = '';
    if (query.q !== undefined && query.q !== '') {
      prefixClause = `AND ${column} ILIKE $q`;
      params['q'] = `${query.q.slice(0, MAX_Q_LENGTH)}%`;
    }

    const sql = `
      SELECT DISTINCT ${column} AS value
      FROM events
      WHERE ${column} IS NOT NULL
        ${prefixClause}
      ORDER BY ${column}
      LIMIT ${limit}
    `;

    const rows = await runQuery(conn, sql, params);
    const values = rows.map(([value]) => value);

    return buildQueryResponse(
      ['Value'],
      values.map((value) => [value]),
      values.slice(0, 5).map((value) => ({ value })),
      { mode: 'distinct_values', field: query.field, values },
    );
  } finally {
    conn.disconnectSync();
  }
}

async function runQuery(
  conn: DuckDBConnection,
  sql: string,
  params: Record<string, string>,
): Promise<[string][]> {
  if (Object.keys(params).length === 0) {
    const result = await conn.runAndReadAll(sql);
    return result.getRows() as [string][];
  }
  const stmt = await conn.prepare(sql);
  await stmt.bind(params);
  const result = await stmt.runAndReadAll();
  return result.getRows() as [string][];
}
