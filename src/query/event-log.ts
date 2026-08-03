/**
 * Query builder for req-004-event-log-query (FEA-001).
 * Returns raw events, optionally scoped by session_id / initiative_id / event_type
 * and (as of 0000015) phase / agent / product_id / a timestamp range.
 *
 * ADR-016 (0000015, amends ADR-010): no scope parameter is required — every
 * request is bounded solely by limit/offset. Default limit: 100, max: 1000.
 */

import type { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import { buildQueryResponse, buildScopeHint, type QueryResponse } from './format-results.js';
import { ALLOWED_EVENT_COLUMNS, SORTABLE_FIELDS } from './column-allow-list.js';

export type EventLogMode = 'event_log';
export type EventLogSort = 'asc' | 'desc';
export type SortField = (typeof SORTABLE_FIELDS)[number];

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

export interface EventLogQuery {
  readonly mode: EventLogMode;
  readonly session_id?: string;
  readonly initiative_id?: string;
  readonly event_type?: string;
  readonly phase?: string;
  readonly agent?: string;
  readonly product_id?: string;
  readonly from?: string;
  readonly to?: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly sort?: EventLogSort;
  readonly sortField?: SortField;
}

/** Returns a paginated raw event log, bounded by limit/offset, with optional filters. */
export async function queryEventLog(db: DuckDBInstance, query: EventLogQuery): Promise<QueryResponse> {
  const limit = Number(query.limit ?? DEFAULT_LIMIT);
  if (limit > MAX_LIMIT) {
    throw new Error(`event_log limit must not exceed ${MAX_LIMIT} (received ${limit})`);
  }
  const offset = Number(query.offset ?? 0);
  const sortDirection = query.sort === 'desc' ? 'DESC' : 'ASC';
  const sortField = query.sortField ?? 'timestamp';
  if (!SORTABLE_FIELDS.includes(sortField)) {
    throw new Error(`Invalid sortField: "${sortField}". Valid values: ${SORTABLE_FIELDS.join(', ')}`);
  }
  const sortColumn = ALLOWED_EVENT_COLUMNS[sortField];

  const conn = await db.connect();
  try {
    const { clause: whereClause, params } = buildWhereClause(query);

    const sql = `
      SELECT id, schema_version, event, session_id, initiative_id, product_id, phase, agent, tool, model,
             mcp_mode, timestamp::VARCHAR AS timestamp, model_config::VARCHAR AS model_config,
             data::VARCHAR AS data, inserted_at::VARCHAR AS inserted_at
      FROM events
      WHERE 1=1
        ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const countSql = `
      SELECT COUNT(*) AS total_count
      FROM events
      WHERE 1=1
        ${whereClause}
    `;

    const rows = await runQuery<unknown[]>(conn, sql, params);
    const countRows = await runQuery<[bigint | number]>(conn, countSql, params);
    const totalCount = Number(countRows[0]?.[0] ?? 0);
    const events = rows.map(rowToRaw);

    const hint = events.length === 0
      ? await buildScopeHint(conn, { session_id: query.session_id, initiative_id: query.initiative_id })
      : undefined;

    const aggregation = {
      mode: 'event_log',
      event_count: events.length,
      total_count: totalCount,
      events,
    };

    return buildQueryResponse(
      ['Timestamp', 'Event', 'Session ID', 'Phase', 'Agent', 'Product'],
      events.map((e) => {
        const ev = e as Record<string, unknown>;
        return [
          String(ev['timestamp'] ?? ''),
          String(ev['event'] ?? ''),
          String(ev['session_id'] ?? ''),
          String(ev['phase'] ?? ''),
          String(ev['agent'] ?? ''),
          String(ev['product_id'] ?? 'unknown'),
        ];
      }),
      events.slice(0, 5),
      aggregation,
      hint,
    );
  } finally {
    conn.disconnectSync();
  }
}

function buildWhereClause(query: EventLogQuery): { clause: string; params: Record<string, string> } {
  const clauses: string[] = [];
  const params: Record<string, string> = {};

  if (query.session_id !== undefined) {
    clauses.push('AND session_id = $session_id');
    params['session_id'] = query.session_id;
  }
  if (query.initiative_id !== undefined) {
    clauses.push('AND initiative_id = $initiative_id');
    params['initiative_id'] = query.initiative_id;
  }
  if (query.event_type !== undefined) {
    clauses.push('AND event = $event_type');
    params['event_type'] = query.event_type;
  }
  if (query.phase !== undefined) {
    clauses.push('AND phase = $phase');
    params['phase'] = query.phase;
  }
  if (query.agent !== undefined) {
    clauses.push('AND agent = $agent');
    params['agent'] = query.agent;
  }
  if (query.product_id !== undefined) {
    clauses.push('AND product_id = $product_id');
    params['product_id'] = query.product_id;
  }
  if (query.from !== undefined) {
    clauses.push('AND timestamp >= $from::TIMESTAMPTZ');
    params['from'] = query.from;
  }
  if (query.to !== undefined) {
    clauses.push('AND timestamp <= $to::TIMESTAMPTZ');
    params['to'] = query.to;
  }

  return { clause: clauses.join(' '), params };
}

async function runQuery<T>(
  conn: DuckDBConnection,
  sql: string,
  params: Record<string, string>,
): Promise<T[]> {
  if (Object.keys(params).length === 0) {
    const result = await conn.runAndReadAll(sql);
    return result.getRows() as T[];
  }
  const stmt = await conn.prepare(sql);
  await stmt.bind(params);
  const result = await stmt.runAndReadAll();
  return result.getRows() as T[];
}

function rowToRaw(row: unknown[]): object {
  const [id, schema_version, event, session_id, initiative_id, product_id, phase, agent, tool, model,
    mcp_mode, timestamp, modelConfigRaw, dataRaw, inserted_at] = row as (string | null)[];
  return {
    id, schema_version, event, session_id, initiative_id, product_id, phase, agent, tool, model, mcp_mode,
    timestamp,
    model_config: modelConfigRaw ? JSON.parse(modelConfigRaw) : null,
    data: dataRaw ? JSON.parse(dataRaw) : null,
    inserted_at,
  };
}
