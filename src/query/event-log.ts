/**
 * Query builder for req-004-event-log-query (FEA-001).
 * Returns raw events with optional session_id / initiative_id / event_type filters.
 * Default limit: 100 events ordered by timestamp DESC.
 */

import type { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import { buildQueryResponse, type QueryResponse } from './format-results.js';

export type EventLogMode = 'event_log';

export interface EventLogQuery {
  readonly mode: EventLogMode;
  readonly session_id?: string;
  readonly initiative_id?: string;
  readonly event_type?: string;
  readonly limit?: number;
}

/** Returns a paginated raw event log, optionally scoped by session / initiative / event type. */
export async function queryEventLog(db: DuckDBInstance, query: EventLogQuery): Promise<QueryResponse> {
  const conn = await db.connect();
  try {
    const { clause: whereClause, params } = buildWhereClause(query);
    const limit = Number(query.limit ?? 100);

    const sql = `
      SELECT id, event, session_id, initiative_id, phase, agent,
             timestamp::VARCHAR AS timestamp, data::VARCHAR AS data
      FROM events
      WHERE 1=1
        ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `;

    const rows = await runQuery<unknown[]>(conn, sql, params);
    const events = rows.map(rowToRaw);

    const aggregation = {
      mode: 'event_log',
      event_count: events.length,
      events,
    };

    return buildQueryResponse(
      ['Timestamp', 'Event', 'Session ID', 'Phase', 'Agent'],
      events.map((e) => {
        const ev = e as Record<string, unknown>;
        return [
          String(ev['timestamp'] ?? ''),
          String(ev['event'] ?? ''),
          String(ev['session_id'] ?? ''),
          String(ev['phase'] ?? ''),
          String(ev['agent'] ?? ''),
        ];
      }),
      events.slice(0, 5),
      aggregation,
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
  const [id, event, session_id, initiative_id, phase, agent, timestamp, dataRaw] = row as (string | null)[];
  return {
    id, event, session_id, initiative_id, phase, agent, timestamp,
    data: dataRaw ? JSON.parse(dataRaw) : null,
  };
}
