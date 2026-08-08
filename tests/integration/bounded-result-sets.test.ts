/**
 * req-007: failure_sequence and drill_down must bound their result sets and
 * report truncation, so one query cannot materialise an unbounded row set
 * (including full data JSON) into memory.
 *
 * Both responses gain `truncated` and `total_count`, nested INSIDE the
 * aggregation object (which surfaces as `json`) — matching event_log's existing
 * placement (event-log.ts:83) and the UI's read at index-html.ts:371. total_count
 * is a COUNT(*), not rows.length, so it reports the true total even when capped.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import type { DuckDBInstance } from '@duckdb/node-api';
import { openDatabase, closeDatabase } from '../../src/db/index.js';
import { DuckDbEventRepository } from '../../src/db/duckdb-event-repository.js';
import { DuckDbQueryService } from '../../src/query/query-service.js';
import type { TelemetryEvent } from '../../src/types/events.js';

const TEST_DB = join(tmpdir(), `telemetry-bounded-test-${Date.now()}.db`);

const BASE: Omit<TelemetryEvent, 'event' | 'data' | 'timestamp'> = {
  schema_version: '1.0',
  session_id: 'bounded-session',
  initiative_id: 'init-bounded',
  phase: 'codegen',
  agent: 'planifest-codegen-agent',
  tool: 'claude-code',
  model: 'claude-sonnet-5',
  mcp_mode: 'context',
};

let qs: DuckDbQueryService;

beforeAll(async () => {
  process.env['PLANIFEST_TELEMETRY_DB'] = TEST_DB;
  const db: DuckDBInstance = await openDatabase(TEST_DB);
  const repo = new DuckDbEventRepository(db);
  qs = new DuckDbQueryService(db);

  // 5 events matching failure_sequence's filter for one session.
  for (let i = 0; i < 5; i++) {
    await repo.write({
      ...BASE, event: 'validation_failure', phase: 'validate',
      timestamp: `2026-04-13T12:0${i}:00Z`,
      data: { failure_type: 'typecheck', phase_name: 'validate', attempt_number: i + 1, action_id: `act-${i}` },
    });
  }
  // 4 events matching drill_down's filter for the same session.
  for (let i = 0; i < 4; i++) {
    await repo.write({
      ...BASE, event: 'context_pressure', phase: 'codegen',
      timestamp: `2026-04-13T13:0${i}:00Z`,
      data: { context_fill_pct: 50 + i, unused_sources: [], trigger: 'threshold' },
    });
  }
});

afterAll(() => {
  closeDatabase();
  try { rmSync(TEST_DB, { force: true }); } catch { /* ignore */ }
  try { rmSync(`${TEST_DB}.wal`, { force: true }); } catch { /* ignore */ }
});

describe('req-007: bounded result sets', () => {
  describe('failure_sequence', () => {
    it('caps rows at the requested limit and reports truncated:true with the true total', async () => {
      const r = await qs.failures({ mode: 'failure_sequence', session_id: 'bounded-session', limit: 2 } as never);
      const json = r.json as Record<string, unknown>;
      expect((json['events'] as unknown[]).length).toBe(2);
      expect(json['truncated']).toBe(true);
      expect(json['total_count']).toBe(5);
    });

    it('returns every row with truncated:false when under the limit', async () => {
      const r = await qs.failures({ mode: 'failure_sequence', session_id: 'bounded-session', limit: 1000 } as never);
      const json = r.json as Record<string, unknown>;
      expect((json['events'] as unknown[]).length).toBe(5);
      expect(json['truncated']).toBe(false);
      expect(json['total_count']).toBe(5);
    });
  });

  describe('drill_down', () => {
    it('caps rows at the requested limit and reports truncated:true with the true total', async () => {
      const r = await qs.tokenEfficiency({ mode: 'drill_down', session_id: 'bounded-session', limit: 2 } as never);
      const json = r.json as Record<string, unknown>;
      expect((json['events'] as unknown[]).length).toBe(2);
      expect(json['truncated']).toBe(true);
      expect(json['total_count']).toBe(4);
    });

    it('returns every row with truncated:false when under the limit', async () => {
      const r = await qs.tokenEfficiency({ mode: 'drill_down', session_id: 'bounded-session', limit: 1000 } as never);
      const json = r.json as Record<string, unknown>;
      expect((json['events'] as unknown[]).length).toBe(4);
      expect(json['truncated']).toBe(false);
      expect(json['total_count']).toBe(4);
    });
  });
});
