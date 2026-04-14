/**
 * Query builders for REQ-002: bottleneck visibility.
 * Aggregates phase/agent/tool/run/content-type duration from phase_end events.
 */

import type { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import { buildQueryResponse, type QueryResponse } from './format-results.js';

export type BottleneckGroupBy = 'phase' | 'agent' | 'tool' | 'run_id' | 'content_type' | 'mcp_mode' | 'initiative_id';

export interface BottleneckQuery {
  readonly group_by: BottleneckGroupBy;
  readonly run_id?: string;
  readonly session_id?: string;
  readonly initiative_id?: string;
  readonly limit?: number;
}

/**
 * Queries duration metrics grouped by the requested dimension.
 * Ranked by avg_duration_ms descending (slowest first).
 */
export async function queryBottlenecks(db: DuckDBInstance, query: BottleneckQuery): Promise<QueryResponse> {
  const conn = await db.connect();

  try {
    const groupCol = resolveGroupColumn(query.group_by);
    const { clause: whereClause, params: whereParams } = buildWhereClause(query);
    const limitClause = query.limit !== undefined ? `LIMIT ${Number(query.limit)}` : '';

    const sql = `
      SELECT
        ${groupCol}                                          AS group_key,
        ROUND(AVG(CAST(data->>'duration_ms' AS DOUBLE)), 2) AS avg_duration_ms,
        ROUND(QUANTILE_CONT(CAST(data->>'duration_ms' AS DOUBLE), 0.95), 2) AS p95_duration_ms,
        ROUND(
          SUM(CASE WHEN data->>'status' = 'pass' THEN 1.0 ELSE 0.0 END) / COUNT(*) * 100, 1
        ) AS success_rate_pct,
        COUNT(*) AS total_events
      FROM events
      WHERE event = 'phase_end'
        ${whereClause}
      GROUP BY ${groupCol}
      ORDER BY avg_duration_ms DESC NULLS LAST
      ${limitClause}
    `;

    const rows = await runQuery<[string, number, number, number, number]>(conn, sql, whereParams);

    const sampleSql = `
      SELECT id, event, session_id, phase, agent, timestamp::VARCHAR AS timestamp, data::VARCHAR AS data
      FROM events
      WHERE event = 'phase_end'
        ${whereClause}
      ORDER BY timestamp DESC
      LIMIT 5
    `;
    const sampleRows = await runQuery<unknown[]>(conn, sampleSql, whereParams);

    const tableRows = rows.map(([key, avg, p95, successRate, total]) =>
      [key, avg, p95, `${successRate}%`, total] as (string | number)[]);

    const aggregation = {
      group_by: query.group_by,
      results: rows.map(([group_key, avg_duration_ms, p95_duration_ms, success_rate_pct, total_events]) => ({
        group_key, avg_duration_ms, p95_duration_ms, success_rate_pct, total_events,
      })),
    };

    return buildQueryResponse(
      ['Group', 'Avg Duration (ms)', 'P95 Duration (ms)', 'Success Rate', 'Total Events'],
      tableRows,
      sampleRows.map(rowToRawEvent),
      aggregation,
    );
  } finally {
    conn.disconnectSync();
  }
}

function resolveGroupColumn(groupBy: BottleneckGroupBy): string {
  switch (groupBy) {
    case 'phase': return 'phase';
    case 'agent': return 'agent';
    case 'tool': return 'tool';
    case 'run_id': return 'session_id';
    case 'content_type': return "COALESCE(data->>'content_type', 'unknown')";
    case 'mcp_mode': return 'mcp_mode';
    case 'initiative_id': return "COALESCE(initiative_id, 'unknown')";
  }
}

function buildWhereClause(query: BottleneckQuery): { clause: string; params: Record<string, string> } {
  const clauses: string[] = [];
  const params: Record<string, string> = {};

  if (query.run_id !== undefined) {
    clauses.push('AND session_id = $run_id');
    params['run_id'] = query.run_id;
  }
  if (query.session_id !== undefined) {
    clauses.push('AND session_id = $session_id');
    params['session_id'] = query.session_id;
  }
  if (query.initiative_id !== undefined) {
    clauses.push('AND initiative_id = $initiative_id');
    params['initiative_id'] = query.initiative_id;
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

function rowToRawEvent(row: unknown[]): object {
  const [id, event, session_id, phase, agent, timestamp, dataRaw] = row as (string | null)[];
  return { id, event, session_id, phase, agent, timestamp, data: dataRaw ? JSON.parse(dataRaw) : null };
}
