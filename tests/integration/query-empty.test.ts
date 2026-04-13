/**
 * Edge-case: all query modes run against an empty database.
 * Verifies cold-start safety — no panics, no crashes, empty results returned gracefully.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { openDatabase, closeDatabase } from '../../src/db/index.js';
import { queryBottlenecks, type BottleneckGroupBy } from '../../src/query/bottlenecks.js';
import { queryFailures, type FailureQueryMode } from '../../src/query/failures.js';
import { queryTokenEfficiency, type TokenEfficiencyMode } from '../../src/query/token-efficiency.js';

const TEST_DB = join(tmpdir(), `telemetry-empty-${Date.now()}.db`);

beforeAll(async () => {
  process.env['PLANIFEST_TELEMETRY_DB'] = TEST_DB;
  await openDatabase(TEST_DB);
  // No seed data — intentionally empty.
});

afterAll(() => {
  closeDatabase();
  try { rmSync(TEST_DB); } catch { /* best effort */ }
  delete process.env['PLANIFEST_TELEMETRY_DB'];
});

describe('query-empty: bottleneck queries on empty DB', () => {
  const groupBys: BottleneckGroupBy[] = ['phase', 'agent', 'tool', 'run_id', 'content_type'];

  for (const group_by of groupBys) {
    it(`group_by ${group_by} returns empty results without throwing`, async () => {
      const response = await queryBottlenecks({ group_by });
      const result = response.json as { results: unknown[] };
      expect(result.results).toHaveLength(0);
      expect(typeof response.markdown).toBe('string');
    });
  }
});

describe('query-empty: failure queries on empty DB', () => {
  const modes: FailureQueryMode[] = ['retry_summary', 'loop_candidates', 'failure_sequence', 'failure_cluster'];

  for (const mode of modes) {
    it(`mode ${mode} returns gracefully without throwing`, async () => {
      const response = await queryFailures({ mode, session_id: 'no-such-session' });
      expect(typeof response.markdown).toBe('string');
      expect(typeof response.json).toBe('object');
      expect(Array.isArray(response.rawSample)).toBe(true);
    });
  }
});

describe('query-empty: token efficiency queries on empty DB', () => {
  const modes: TokenEfficiencyMode[] = ['context_pressure', 'mcp_impact', 'request_volume', 'trend', 'drill_down'];

  for (const mode of modes) {
    it(`mode ${mode} returns gracefully without throwing`, async () => {
      const response = await queryTokenEfficiency({ mode, session_id: 'no-such-session' });
      expect(typeof response.markdown).toBe('string');
      expect(typeof response.json).toBe('object');
      expect(Array.isArray(response.rawSample)).toBe(true);
    });
  }
});
