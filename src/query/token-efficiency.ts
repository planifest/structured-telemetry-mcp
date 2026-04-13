/**
 * Query builders for REQ-004: token and request efficiency.
 * Context pressure, MCP impact, request volume, trend analysis.
 */

import type { DuckDBConnection } from '@duckdb/node-api';
import { openDatabase } from '../db/index.js';
import { buildQueryResponse, type QueryResponse } from './format-results.js';

export type TokenEfficiencyMode = 'context_pressure' | 'mcp_impact' | 'request_volume' | 'trend' | 'drill_down';

export interface TokenEfficiencyQuery {
  readonly mode: TokenEfficiencyMode;
  readonly session_id?: string;
  readonly limit?: number;
}

/** Dispatches to the appropriate token efficiency query mode. */
export async function queryTokenEfficiency(query: TokenEfficiencyQuery): Promise<QueryResponse> {
  switch (query.mode) {
    case 'context_pressure': return queryContextPressure();
    case 'mcp_impact': return queryMcpImpact();
    case 'request_volume': return queryRequestVolume();
    case 'trend': return queryTrend(query.limit ?? 30);
    case 'drill_down': return queryDrillDown(query.session_id ?? '');
  }
}

/** Mode A: avg and max context fill % per phase, ranked highest first. */
async function queryContextPressure(): Promise<QueryResponse> {
  const db = await openDatabase();
  const conn = await db.connect();
  try {
    const sql = `
      SELECT
        phase,
        ROUND(AVG(CAST(data->>'context_fill_pct' AS DOUBLE)), 1) AS avg_peak_fill_pct,
        ROUND(MAX(CAST(data->>'context_fill_pct' AS DOUBLE)), 1) AS max_peak_fill_pct,
        COUNT(*) AS sample_count
      FROM events
      WHERE event = 'context_pressure'
      GROUP BY phase
      ORDER BY avg_peak_fill_pct DESC NULLS LAST
    `;

    const rows = await runQuery<[string, number, number, number]>(conn, sql, {});
    const rawSample = await sampleEvents(conn, "event = 'context_pressure'");

    const aggregation = {
      mode: 'context_pressure',
      results: rows.map(([phase, avg_peak_fill_pct, max_peak_fill_pct, sample_count]) =>
        ({ phase, avg_peak_fill_pct, max_peak_fill_pct, sample_count })),
    };

    return buildQueryResponse(
      ['Phase', 'Avg Peak Fill %', 'Max Peak Fill %', 'Sample Count'],
      rows.map(([phase, avg, max, count]) => [phase, `${avg}%`, `${max}%`, count]),
      rawSample, aggregation,
    );
  } finally {
    conn.disconnectSync();
  }
}

/** Mode B: avg token delta and peak fill per mcp_mode configuration. */
async function queryMcpImpact(): Promise<QueryResponse> {
  const db = await openDatabase();
  const conn = await db.connect();
  try {
    const sql = `
      SELECT
        data->>'mcp_mode'                                              AS mcp_mode,
        ROUND(AVG(CAST(data->>'avg_token_delta' AS DOUBLE)), 0)        AS avg_token_delta,
        ROUND(AVG(CAST(data->>'peak_fill_pct' AS DOUBLE)), 1)          AS avg_peak_fill_pct,
        COUNT(*)                                                        AS sample_count
      FROM events
      WHERE event = 'mcp_impact'
      GROUP BY data->>'mcp_mode'
      ORDER BY avg_peak_fill_pct ASC
    `;

    const rows = await runQuery<[string, number, number, number]>(conn, sql, {});
    const rawSample = await sampleEvents(conn, "event = 'mcp_impact'");

    const aggregation = {
      mode: 'mcp_impact',
      results: rows.map(([mcp_mode, avg_token_delta, avg_peak_fill_pct, sample_count]) =>
        ({ mcp_mode, avg_token_delta, avg_peak_fill_pct, sample_count })),
    };

    return buildQueryResponse(
      ['MCP Mode', 'Avg Token Delta', 'Avg Peak Fill %', 'Samples'],
      rows.map(([mode, delta, fill, count]) => [mode, delta, `${fill}%`, count]),
      rawSample, aggregation,
    );
  } finally {
    conn.disconnectSync();
  }
}

/** Mode C: total tool calls and avg calls per phase, per agent. */
async function queryRequestVolume(): Promise<QueryResponse> {
  const db = await openDatabase();
  const conn = await db.connect();
  try {
    const sql = `
      SELECT
        agent,
        COUNT(*)                                                                AS total_tool_calls,
        ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT session_id || '|' || phase), 1)  AS avg_calls_per_phase
      FROM events
      GROUP BY agent
      ORDER BY total_tool_calls DESC
    `;

    const rows = await runQuery<[string, number, number]>(conn, sql, {});
    const rawSample = await sampleEvents(conn, '1=1');

    const aggregation = {
      mode: 'request_volume',
      results: rows.map(([agent, total_tool_calls, avg_calls_per_phase]) =>
        ({ agent, total_tool_calls, avg_calls_per_phase })),
    };

    return buildQueryResponse(
      ['Agent', 'Total Tool Calls', 'Avg Calls per Phase'],
      rows.map(([agent, total, avg]) => [agent, total, avg]),
      rawSample, aggregation,
    );
  } finally {
    conn.disconnectSync();
  }
}

/** Mode D: context pressure trend over time (by day). */
async function queryTrend(limitDays: number): Promise<QueryResponse> {
  const db = await openDatabase();
  const conn = await db.connect();
  try {
    const sql = `
      SELECT
        CAST(timestamp AS DATE)::VARCHAR                                         AS run_date,
        ROUND(AVG(CAST(data->>'context_fill_pct' AS DOUBLE)), 1)                AS avg_peak_fill_pct,
        ROUND(MAX(CAST(data->>'context_fill_pct' AS DOUBLE)), 1)                AS max_peak_fill_pct,
        COUNT(*)                                                                 AS event_count
      FROM events
      WHERE event = 'context_pressure'
        AND timestamp >= (now() - INTERVAL '${Number(limitDays)} days')
      GROUP BY CAST(timestamp AS DATE)
      ORDER BY run_date ASC
    `;

    const rows = await runQuery<[string, number, number, number]>(conn, sql, {});
    const rawSample = await sampleEvents(conn, "event = 'context_pressure'");

    const aggregation = {
      mode: 'trend',
      limit_days: limitDays,
      results: rows.map(([run_date, avg_peak_fill_pct, max_peak_fill_pct, event_count]) =>
        ({ run_date, avg_peak_fill_pct, max_peak_fill_pct, event_count })),
    };

    return buildQueryResponse(
      ['Date', 'Avg Peak Fill %', 'Max Peak Fill %', 'Events'],
      rows.map(([date, avg, max, count]) => [date, `${avg}%`, `${max}%`, count]),
      rawSample, aggregation,
    );
  } finally {
    conn.disconnectSync();
  }
}

/** Mode E: full raw event detail for a session (context_pressure + mcp_impact). */
async function queryDrillDown(sessionId: string): Promise<QueryResponse> {
  const db = await openDatabase();
  const conn = await db.connect();
  try {
    const sql = `
      SELECT id, event, session_id, phase, agent, timestamp::VARCHAR AS timestamp, data::VARCHAR AS data
      FROM events
      WHERE session_id = $session_id
        AND event IN ('context_pressure', 'mcp_impact')
      ORDER BY timestamp ASC
    `;

    const rawRows = await runQuery<unknown[]>(conn, sql, { session_id: sessionId });
    const rows = rawRows.map(rowToRaw);
    const rawSample = rows.slice(0, 5);

    const aggregation = {
      mode: 'drill_down',
      session_id: sessionId,
      event_count: rows.length,
      events: rows,
    };

    return buildQueryResponse(
      ['Timestamp', 'Event', 'Phase', 'Fill %', 'Unused Sources'],
      rows.map((r) => {
        const e = r as Record<string, unknown>;
        const data = (e['data'] as Record<string, unknown> | null) ?? {};
        return [
          String(e['timestamp'] ?? ''),
          String(e['event'] ?? ''),
          String(e['phase'] ?? ''),
          String(data['context_fill_pct'] ?? data['peak_fill_pct'] ?? ''),
          Array.isArray(data['unused_sources']) ? (data['unused_sources'] as string[]).join(', ') : '',
        ];
      }),
      rawSample, aggregation,
    );
  } finally {
    conn.disconnectSync();
  }
}

async function runQuery<T>(
  conn: DuckDBConnection,
  sql: string,
  params: Record<string, string | number>,
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

async function sampleEvents(conn: DuckDBConnection, where: string): Promise<object[]> {
  const result = await conn.runAndReadAll(
    `SELECT id, event, session_id, phase, agent, timestamp::VARCHAR AS timestamp, data::VARCHAR AS data
     FROM events WHERE ${where} ORDER BY timestamp DESC LIMIT 5`,
  );
  return (result.getRows() as Array<unknown[]>).map(rowToRaw);
}

function rowToRaw(row: unknown[]): object {
  const [id, event, session_id, phase, agent, timestamp, dataRaw] = row as (string | null)[];
  return { id, event, session_id, phase, agent, timestamp, data: dataRaw ? JSON.parse(dataRaw) : null };
}
