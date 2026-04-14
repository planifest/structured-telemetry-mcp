/**
 * Query builders for REQ-003: failure and loop detection.
 * Retry instances, pass/fail rates, consecutive failure detection.
 */

import type { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import { buildQueryResponse, type QueryResponse } from './format-results.js';

export type FailureQueryMode = 'retry_summary' | 'loop_candidates' | 'failure_sequence' | 'failure_cluster';

export interface FailureQuery {
  readonly mode: FailureQueryMode;
  readonly session_id?: string;
  readonly initiative_id?: string;
  readonly loop_threshold?: number;
}

/** Dispatches to the appropriate failure query mode. */
export async function queryFailures(db: DuckDBInstance, query: FailureQuery): Promise<QueryResponse> {
  const initiativeId = query.initiative_id;
  switch (query.mode) {
    case 'retry_summary': return queryRetrySummary(db, initiativeId);
    case 'loop_candidates': return queryLoopCandidates(db, query.loop_threshold ?? 5, initiativeId);
    case 'failure_sequence': return queryFailureSequence(db, query.session_id ?? '', initiativeId);
    case 'failure_cluster': return queryFailureCluster(db, initiativeId);
  }
}

/** Mode A: retry instance count and pass/fail rate per session+phase. */
async function queryRetrySummary(db: DuckDBInstance, initiativeId?: string): Promise<QueryResponse> {
  const conn = await db.connect();
  try {
    const initiativeClause = initiativeId ? 'AND initiative_id = $initiative_id' : '';
    const params: Record<string, string> = initiativeId ? { initiative_id: initiativeId } : {};
    const sql = `
      WITH retry_instances AS (
        SELECT
          session_id,
          phase,
          data->>'action_id'   AS action_id,
          COUNT(*)              AS attempt_count,
          MAX(CAST(data->>'attempt_number' AS INTEGER)) AS max_attempt
        FROM events
        WHERE event = 'validation_failure'
          ${initiativeClause}
        GROUP BY session_id, phase, data->>'action_id'
        HAVING COUNT(*) >= 1
      ),
      with_pass AS (
        SELECT
          ri.*,
          CASE WHEN max_attempt <= 5 THEN 1 ELSE 0 END AS passed_within_5
        FROM retry_instances ri
      )
      SELECT
        session_id,
        phase,
        COUNT(*)                                    AS retry_instance_count,
        ROUND(AVG(passed_within_5) * 100, 1)        AS pass_rate_within_5_retries,
        ROUND((1 - AVG(passed_within_5)) * 100, 1)  AS fail_rate_within_5_retries
      FROM with_pass
      GROUP BY session_id, phase
      ORDER BY retry_instance_count DESC
    `;

    const rows = await runQuery<[string, string, number, number, number]>(conn, sql, params);
    const sampleWhere = initiativeId
      ? "event = 'validation_failure' AND initiative_id = $initiative_id"
      : "event = 'validation_failure'";
    const rawSample = await sampleEvents(conn, sampleWhere, params);

    const tableRows = rows.map(([sid, phase, count, passRate, failRate]) =>
      [sid, phase, count, `${passRate}%`, `${failRate}%`]);
    const aggregation = {
      mode: 'retry_summary',
      results: rows.map(([session_id, phase, retry_instance_count, pass_rate_within_5_retries, fail_rate_within_5_retries]) =>
        ({ session_id, phase, retry_instance_count, pass_rate_within_5_retries, fail_rate_within_5_retries })),
    };

    return buildQueryResponse(
      ['Session ID', 'Phase', 'Retry Instances', 'Pass Rate (≤5)', 'Fail Rate (≤5)'],
      tableRows, rawSample, aggregation,
    );
  } finally {
    conn.disconnectSync();
  }
}

/** Mode B: sessions where consecutive identical failures >= threshold. */
async function queryLoopCandidates(db: DuckDBInstance, threshold: number, initiativeId?: string): Promise<QueryResponse> {
  const conn = await db.connect();
  try {
    const initiativeClause = initiativeId ? 'AND initiative_id = $initiative_id' : '';
    const loopParams: Record<string, string> = initiativeId ? { initiative_id: initiativeId } : {};
    const sql = `
      WITH ordered AS (
        SELECT
          session_id, phase,
          data->>'failure_type'  AS failure_type,
          timestamp,
          ROW_NUMBER() OVER (PARTITION BY session_id, phase ORDER BY timestamp) AS rn
        FROM events
        WHERE event = 'validation_failure'
          ${initiativeClause}
      ),
      grouped AS (
        SELECT
          session_id, phase, failure_type,
          rn - ROW_NUMBER() OVER (PARTITION BY session_id, phase, failure_type ORDER BY rn) AS grp
        FROM ordered
      ),
      runs AS (
        SELECT session_id, phase, failure_type, COUNT(*) AS consecutive_count
        FROM grouped
        GROUP BY session_id, phase, failure_type, grp
      )
      SELECT session_id, phase, failure_type, consecutive_count
      FROM runs
      WHERE consecutive_count >= ${Number(threshold)}
      ORDER BY consecutive_count DESC
    `;

    const rows = await runQuery<[string, string, string, number]>(conn, sql, loopParams);
    const sampleWhere = initiativeId
      ? "event = 'validation_failure' AND initiative_id = $initiative_id"
      : "event = 'validation_failure'";
    const rawSample = await sampleEvents(conn, sampleWhere, loopParams);

    const aggregation = {
      mode: 'loop_candidates',
      threshold,
      results: rows.map(([session_id, phase, failure_type, consecutive_count]) =>
        ({ session_id, phase, failure_type, consecutive_count })),
    };

    return buildQueryResponse(
      ['Session ID', 'Phase', 'Failure Type', 'Consecutive Count'],
      rows.map(([sid, phase, ft, count]) => [sid, phase, ft, count]),
      rawSample, aggregation,
    );
  } finally {
    conn.disconnectSync();
  }
}

/** Mode C: ordered event timeline for a session. */
async function queryFailureSequence(db: DuckDBInstance, sessionId: string, initiativeId?: string): Promise<QueryResponse> {
  const conn = await db.connect();
  try {
    const initiativeClause = initiativeId ? 'AND initiative_id = $initiative_id' : '';
    const params: Record<string, string> = { session_id: sessionId };
    if (initiativeId) params['initiative_id'] = initiativeId;

    const sql = `
      SELECT id, event, session_id, phase, agent, timestamp::VARCHAR AS timestamp, data::VARCHAR AS data
      FROM events
      WHERE session_id = $session_id
        AND event IN ('phase_start', 'validation_failure', 'self_correction', 'phase_end')
        ${initiativeClause}
      ORDER BY timestamp ASC
    `;

    const rows = await runQuery<unknown[]>(conn, sql, params);
    const rawSample = rows.slice(0, 5).map(rowToRaw);

    const aggregation = {
      mode: 'failure_sequence',
      session_id: sessionId,
      event_count: rows.length,
      events: rows.map(rowToRaw),
    };

    return buildQueryResponse(
      ['Timestamp', 'Event', 'Phase', 'Agent'],
      rows.map((r) => {
        const raw = rowToRaw(r) as Record<string, string>;
        return [raw['timestamp'], raw['event'], raw['phase'], raw['agent']];
      }),
      rawSample, aggregation,
    );
  } finally {
    conn.disconnectSync();
  }
}

/** Mode D: failure count per phase across all sessions. */
async function queryFailureCluster(db: DuckDBInstance, initiativeId?: string): Promise<QueryResponse> {
  const conn = await db.connect();
  try {
    const initiativeClause = initiativeId ? 'AND initiative_id = $initiative_id' : '';
    const params: Record<string, string> = initiativeId ? { initiative_id: initiativeId } : {};
    const sql = `
      SELECT phase, COUNT(*) AS total_count, COUNT(DISTINCT session_id) AS unique_session_count
      FROM events
      WHERE event = 'validation_failure'
        ${initiativeClause}
      GROUP BY phase
      ORDER BY total_count DESC
    `;

    const rows = await runQuery<[string, number, number]>(conn, sql, params);
    const sampleWhere = initiativeId
      ? "event = 'validation_failure' AND initiative_id = $initiative_id"
      : "event = 'validation_failure'";
    const rawSample = await sampleEvents(conn, sampleWhere, params);

    const aggregation = {
      mode: 'failure_cluster',
      results: rows.map(([phase, total_count, unique_session_count]) => ({ phase, total_count, unique_session_count })),
    };

    return buildQueryResponse(
      ['Phase', 'Total Failures', 'Unique Sessions'],
      rows.map(([phase, total, unique]) => [phase, total, unique]),
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

async function sampleEvents(
  conn: DuckDBConnection,
  where: string,
  params: Record<string, string | number> = {},
): Promise<object[]> {
  const sql = `SELECT id, event, session_id, phase, agent, timestamp::VARCHAR AS timestamp, data::VARCHAR AS data
     FROM events WHERE ${where} ORDER BY timestamp DESC LIMIT 5`;
  return (await runQuery<unknown[]>(conn, sql, params)).map(rowToRaw);
}

function rowToRaw(row: unknown[]): object {
  const [id, event, session_id, phase, agent, timestamp, dataRaw] = row as (string | null)[];
  return { id, event, session_id, phase, agent, timestamp, data: dataRaw ? JSON.parse(dataRaw) : null };
}
