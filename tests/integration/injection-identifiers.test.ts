/**
 * req-009: genuine injection-shaped input against the two identifier-valued
 * query inputs — event_log's sortField and distinct_values' field. DuckDB has
 * no parameterised-identifier binding (0000017 R-001), so the ADR-024 allow-list
 * IS the entire defence; before 0000019 no test passed a quote, semicolon,
 * comment marker, or prototype key.
 *
 * Each case asserts BOTH a rejection AND that the events table is unchanged
 * afterwards. The prototype keys (constructor, __proto__, prototype) prove the
 * check is not a bare property lookup against a plain object, which would return
 * an inherited member and pass a naive truthiness test.
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

const TEST_DB = join(tmpdir(), `telemetry-injection-test-${Date.now()}.db`);

const INJECTION_CORPUS = [
  "'",
  '"',
  ';',
  '--',
  '/* */',
  'UNION SELECT',
  '`',
  'time\nstamp',
  'timestamp; DROP TABLE events',
  'constructor',
  '__proto__',
  'prototype',
  'not_a_real_field',
];

let qs: DuckDbQueryService;
let repo: DuckDbEventRepository;

const BASE: Omit<TelemetryEvent, 'event' | 'data'> = {
  schema_version: '1.0', session_id: 'inj-sess', initiative_id: 'inj-init',
  phase: 'codegen', agent: 'a', tool: 'claude-code', model: 'm', mcp_mode: 'context',
  timestamp: '2026-08-08T12:00:00Z',
};

async function eventCount(): Promise<number> {
  const r = await qs.eventLog({ mode: 'event_log', limit: 1000 } as never);
  return (r.json as { total_count: number }).total_count;
}

beforeAll(async () => {
  process.env['PLANIFEST_TELEMETRY_DB'] = TEST_DB;
  const db: DuckDBInstance = await openDatabase(TEST_DB);
  repo = new DuckDbEventRepository(db);
  qs = new DuckDbQueryService(db);
  await repo.write({ ...BASE, event: 'phase_start', data: { phase_name: 'codegen' } });
  await repo.write({ ...BASE, event: 'phase_end', data: { phase_name: 'codegen', status: 'pass', duration_ms: 100 } });
});

afterAll(() => {
  closeDatabase();
  try { rmSync(TEST_DB, { force: true }); } catch { /* ignore */ }
  try { rmSync(`${TEST_DB}.wal`, { force: true }); } catch { /* ignore */ }
});

describe('req-009: injection-shaped identifiers are rejected before SQL, table unchanged', () => {
  it('rejects every corpus value as an event_log sortField', async () => {
    const before = await eventCount();
    for (const bad of INJECTION_CORPUS) {
      await expect(
        qs.eventLog({ mode: 'event_log', sortField: bad } as never),
        `sortField=${JSON.stringify(bad)} should be rejected`,
      ).rejects.toThrow();
    }
    expect(await eventCount()).toBe(before);
  });

  it('rejects every corpus value as a distinct_values field', async () => {
    const before = await eventCount();
    for (const bad of INJECTION_CORPUS) {
      await expect(
        qs.distinctValues({ mode: 'distinct_values', field: bad } as never),
        `field=${JSON.stringify(bad)} should be rejected`,
      ).rejects.toThrow();
    }
    expect(await eventCount()).toBe(before);
  });

  it('rejects the prototype keys specifically (not a bare property lookup)', async () => {
    for (const proto of ['constructor', '__proto__', 'prototype']) {
      await expect(qs.eventLog({ mode: 'event_log', sortField: proto } as never)).rejects.toThrow();
      await expect(qs.distinctValues({ mode: 'distinct_values', field: proto } as never)).rejects.toThrow();
    }
  });

  it('still accepts a genuinely allow-listed field (control)', async () => {
    await expect(qs.eventLog({ mode: 'event_log', sortField: 'agent' } as never)).resolves.toBeDefined();
    await expect(qs.distinctValues({ mode: 'distinct_values', field: 'agent' } as never)).resolves.toBeDefined();
  });
});
