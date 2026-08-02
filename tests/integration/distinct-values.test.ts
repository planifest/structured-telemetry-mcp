import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import type { DuckDBInstance } from '@duckdb/node-api';
import { openDatabase, closeDatabase } from '../../src/db/index.js';
import { DuckDbEventRepository } from '../../src/db/duckdb-event-repository.js';
import { DuckDbQueryService } from '../../src/query/query-service.js';
import type { TelemetryEvent } from '../../src/types/events.js';

// req-002-filter-combobox-suggestions: distinct_values query mode (backend)

const TEST_DB = join(tmpdir(), `telemetry-distinct-values-test-${Date.now()}.db`);

const BASE: Omit<TelemetryEvent, 'event' | 'data' | 'agent' | 'initiative_id' | 'product_id'> = {
  schema_version: '1.0',
  session_id: 'distinct-test-session',
  phase: 'codegen',
  tool: 'claude-code',
  model: 'claude-sonnet-4-6',
  mcp_mode: 'context',
  timestamp: '2026-04-13T12:00:00Z',
};

let qs: DuckDbQueryService;

beforeAll(async () => {
  process.env['PLANIFEST_TELEMETRY_DB'] = TEST_DB;
  const db: DuckDBInstance = await openDatabase(TEST_DB);
  const repo = new DuckDbEventRepository(db);
  qs = new DuckDbQueryService(db);

  // Seed: distinct + duplicate agent values (req-002-a: alphabetical, deduped).
  const agents = ['zeta-agent', 'alpha-agent', 'mid-agent', 'alpha-agent'];
  for (const agent of agents) {
    await repo.write({ ...BASE, agent, event: 'phase_start', data: { phase_name: 'codegen' } });
  }

  // Seed: distinct initiative_id values for prefix-match test (req-002-b).
  const initiatives = ['proj-apple', 'proj-avocado', 'proj-banana'];
  for (const initiative_id of initiatives) {
    await repo.write({
      ...BASE, agent: 'prefix-test-agent', initiative_id, event: 'phase_start',
      data: { phase_name: 'codegen' },
    });
  }

  // Seed: one event with a product_id, one without (null) — non-null filtering.
  await repo.write({ ...BASE, agent: 'null-test-agent', product_id: 'has-product-id', event: 'phase_start', data: { phase_name: 'codegen' } });
  await repo.write({ ...BASE, agent: 'null-test-agent', event: 'phase_start', data: { phase_name: 'codegen' } });

  // Seed: 25 distinct product_id values, to exercise the 20-item cap (req-002-d).
  for (let i = 0; i < 25; i += 1) {
    const suffix = String(i).padStart(2, '0');
    await repo.write({
      ...BASE, agent: 'cap-test-agent', product_id: `cap-test-product-${suffix}`, event: 'phase_start',
      data: { phase_name: 'codegen' },
    });
  }
});

afterAll(() => {
  closeDatabase();
  try { rmSync(TEST_DB); } catch { /* best effort */ }
  delete process.env['PLANIFEST_TELEMETRY_DB'];
});

describe('req-002-filter-combobox-suggestions: DuckDbQueryService.distinctValues', () => {
  it('returns up to 20 distinct non-null agent values, alphabetically ordered', async () => {
    const response = await qs.distinctValues({ mode: 'distinct_values', field: 'agent' });
    const result = response.json as { mode: string; field: string; values: string[] };
    expect(result.mode).toBe('distinct_values');
    expect(result.field).toBe('agent');
    expect(result.values).toContain('alpha-agent');
    expect(result.values).toContain('zeta-agent');
    expect(result.values).toContain('mid-agent');
    // deduped: 'alpha-agent' was seeded twice
    expect(result.values.filter((v) => v === 'alpha-agent')).toHaveLength(1);
    const sorted = [...result.values].sort();
    expect(result.values).toEqual(sorted);
    expect(result.values.length).toBeLessThanOrEqual(20);
  });

  it('includes Markdown and rawSample in the standard response envelope', async () => {
    const response = await qs.distinctValues({ mode: 'distinct_values', field: 'agent' });
    expect(typeof response.markdown).toBe('string');
    expect(response.markdown).toContain('|');
    expect(Array.isArray(response.rawSample)).toBe(true);
    expect(response.rawSample.length).toBeLessThanOrEqual(5);
  });

  it('narrows results case-insensitively via a q prefix param', async () => {
    const response = await qs.distinctValues({ mode: 'distinct_values', field: 'initiative_id', q: 'PROJ-A' });
    const result = response.json as { values: string[] };
    expect(result.values.sort()).toEqual(['proj-apple', 'proj-avocado']);
    expect(result.values).not.toContain('proj-banana');
  });

  it('excludes null values from the results', async () => {
    const response = await qs.distinctValues({ mode: 'distinct_values', field: 'product_id', q: 'has-product' });
    const result = response.json as { values: string[] };
    expect(result.values).toEqual(['has-product-id']);
  });

  it('rejects an unrecognised field before any SQL executes', async () => {
    await expect(
      qs.distinctValues({ mode: 'distinct_values', field: 'not_a_real_field' }),
    ).rejects.toThrow(/Invalid field/);
  });

  it('rejects "timestamp" — sortable but not suggestible', async () => {
    await expect(
      qs.distinctValues({ mode: 'distinct_values', field: 'timestamp' }),
    ).rejects.toThrow(/Invalid field/);
  });

  it('caps results at 20 even when more distinct values exist', async () => {
    const response = await qs.distinctValues({ mode: 'distinct_values', field: 'product_id', q: 'cap-test' });
    const result = response.json as { values: string[] };
    expect(result.values).toHaveLength(20);
    // alphabetically ordered — first 20 of the 25 seeded (00..19)
    expect(result.values[0]).toBe('cap-test-product-00');
    expect(result.values[19]).toBe('cap-test-product-19');
  });
});
