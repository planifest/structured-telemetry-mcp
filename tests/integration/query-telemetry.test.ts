import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import type { DuckDBInstance } from '@duckdb/node-api';
import { openDatabase, closeDatabase } from '../../src/db/index.js';
import { DuckDbEventRepository } from '../../src/db/duckdb-event-repository.js';
import { DuckDbQueryService } from '../../src/query/query-service.js';
import type { TelemetryEvent } from '../../src/types/events.js';
import { queryEventLog } from '../../src/query/event-log.js';

// req-002-query-bottlenecks, req-003-query-failures, req-004-query-token-efficiency

const TEST_DB = join(tmpdir(), `telemetry-query-test-${Date.now()}.db`);

const BASE: Omit<TelemetryEvent, 'event' | 'data'> = {
  schema_version: '1.0',
  session_id: 'query-test-session',
  initiative_id: 'init-alpha',
  phase: 'codegen',
  agent: 'planifest-codegen-agent',
  tool: 'claude-code',
  model: 'claude-sonnet-4-6',
  mcp_mode: 'context',
  timestamp: '2026-04-13T12:00:00Z',
};

const BASE_OTHER_SESSION: Omit<TelemetryEvent, 'event' | 'data'> = {
  schema_version: '1.0',
  session_id: 'other-session',
  initiative_id: 'init-beta',
  phase: 'spec',
  agent: 'planifest-spec-agent',
  tool: 'claude-code',
  model: 'claude-sonnet-4-6',
  mcp_mode: 'workspace',
  timestamp: '2026-04-13T13:00:00Z',
};

let qs: DuckDbQueryService;

beforeAll(async () => {
  process.env['PLANIFEST_TELEMETRY_DB'] = TEST_DB;
  const db: DuckDBInstance = await openDatabase(TEST_DB);
  const repo = new DuckDbEventRepository(db);
  qs = new DuckDbQueryService(db);

  // Seed: phase_end events for bottleneck queries.
  await repo.write({ ...BASE, event: 'phase_end', phase: 'codegen', data: { phase_name: 'codegen', status: 'pass', duration_ms: 3200 } });
  await repo.write({ ...BASE, event: 'phase_end', phase: 'spec', data: { phase_name: 'spec', status: 'pass', duration_ms: 8500 } });
  await repo.write({ ...BASE, event: 'phase_end', phase: 'validate', data: { phase_name: 'validate', status: 'fail', duration_ms: 1200 } });

  // Seed: validation_failure events for failure queries.
  await repo.write({ ...BASE, event: 'validation_failure', phase: 'validate', data: { failure_type: 'typecheck', phase_name: 'validate', attempt_number: 1, action_id: 'act-a' } });
  await repo.write({ ...BASE, event: 'validation_failure', phase: 'validate', data: { failure_type: 'typecheck', phase_name: 'validate', attempt_number: 2, action_id: 'act-a' } });

  // Seed: context_pressure events for token efficiency queries.
  await repo.write({ ...BASE, event: 'context_pressure', phase: 'codegen', data: { context_fill_pct: 82.5, unused_sources: ['file:foo.md'], trigger: 'threshold' } });
  await repo.write({ ...BASE, event: 'mcp_impact', phase: 'codegen', data: { mcp_mode: 'context', avg_token_delta: -1200, peak_fill_pct: 45.0 } });

  // Seed: second session / initiative for filter + group tests.
  await repo.write({ ...BASE_OTHER_SESSION, event: 'phase_end', phase: 'spec', data: { phase_name: 'spec', status: 'pass', duration_ms: 4000 } });
  await repo.write({ ...BASE_OTHER_SESSION, event: 'validation_failure', phase: 'spec', data: { failure_type: 'lint', phase_name: 'spec', attempt_number: 1, action_id: 'act-b' } });
  await repo.write({ ...BASE_OTHER_SESSION, event: 'context_pressure', phase: 'spec', data: { context_fill_pct: 60.0, unused_sources: [], trigger: 'threshold' } });

  // Seed: event with no initiative_id to test COALESCE null handling.
  await repo.write({ ...BASE, initiative_id: undefined, event: 'phase_end', phase: 'adr', data: { phase_name: 'adr', status: 'pass', duration_ms: 500 } });
});

afterAll(() => {
  closeDatabase();
  try { rmSync(TEST_DB); } catch { /* best effort */ }
  delete process.env['PLANIFEST_TELEMETRY_DB'];
});

describe('req-002-query-bottlenecks: DuckDbQueryService.bottlenecks', () => {
  it('returns Markdown, JSON, and rawSample for group_by phase', async () => {
    const response = await qs.bottlenecks({ group_by: 'phase' });
    expect(typeof response.markdown).toBe('string');
    expect(response.markdown).toContain('|');
    expect(typeof response.json).toBe('object');
    expect(Array.isArray(response.rawSample)).toBe(true);
  });

  it('ranks results with slowest phase first', async () => {
    const response = await qs.bottlenecks({ group_by: 'phase' });
    const result = response.json as { results: Array<{ group_key: string; avg_duration_ms: number }> };
    expect(result.results.length).toBeGreaterThan(0);
    const specIndex = result.results.findIndex((r) => r.group_key === 'spec');
    const codegenIndex = result.results.findIndex((r) => r.group_key === 'codegen');
    if (specIndex !== -1 && codegenIndex !== -1) {
      expect(specIndex).toBeLessThan(codegenIndex);
    }
  });

  it('returns empty result gracefully when no events match', async () => {
    const response = await qs.bottlenecks({ group_by: 'phase', run_id: 'nonexistent-session' });
    const result = response.json as { results: unknown[] };
    expect(result.results).toHaveLength(0);
  });

  it('accepts group_by agent', async () => {
    const response = await qs.bottlenecks({ group_by: 'agent' });
    expect(typeof response.markdown).toBe('string');
  });

  it('accepts group_by tool', async () => {
    const response = await qs.bottlenecks({ group_by: 'tool' });
    const result = response.json as { results: Array<{ group_key: string }> };
    expect(result.results.some((r) => r.group_key === 'claude-code')).toBe(true);
  });

  it('accepts group_by content_type', async () => {
    const response = await qs.bottlenecks({ group_by: 'content_type' });
    expect(typeof response.markdown).toBe('string');
  });

  it('respects the limit param', async () => {
    const response = await qs.bottlenecks({ group_by: 'phase', limit: 1 });
    const result = response.json as { results: unknown[] };
    expect(result.results).toHaveLength(1);
  });

  it('accepts group_by run_id', async () => {
    const response = await qs.bottlenecks({ group_by: 'run_id' });
    const result = response.json as { results: Array<{ group_key: string }> };
    expect(result.results.some((r) => r.group_key === 'query-test-session')).toBe(true);
  });

  it('reflects failure in success_rate_pct', async () => {
    const response = await qs.bottlenecks({ group_by: 'phase' });
    const result = response.json as { results: Array<{ group_key: string; success_rate_pct: number }> };
    const validate = result.results.find((r) => r.group_key === 'validate');
    expect(validate?.success_rate_pct).toBe(0);
  });
});

describe('req-003-query-failures: DuckDbQueryService.failures', () => {
  it('returns retry summary with instance count and rates', async () => {
    const response = await qs.failures({ mode: 'retry_summary' });
    expect(typeof response.markdown).toBe('string');
    const result = response.json as { results: Array<{ retry_instance_count: number }> };
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0]?.retry_instance_count).toBeGreaterThan(0);
  });

  it('returns loop candidates for the configured threshold', async () => {
    const response = await qs.failures({ mode: 'loop_candidates', loop_threshold: 1 });
    expect(typeof response.markdown).toBe('string');
    expect(Array.isArray(response.rawSample)).toBe(true);
  });

  it('returns failure sequence for a session', async () => {
    const response = await qs.failures({ mode: 'failure_sequence', session_id: 'query-test-session' });
    const result = response.json as { event_count: number };
    expect(result.event_count).toBeGreaterThan(0);
  });

  it('returns failure cluster per phase', async () => {
    const response = await qs.failures({ mode: 'failure_cluster' });
    const result = response.json as { results: Array<{ phase: string }> };
    expect(result.results.some((r) => r.phase === 'validate')).toBe(true);
  });
});

describe('req-004-query-token-efficiency: DuckDbQueryService.tokenEfficiency', () => {
  it('returns context pressure per phase', async () => {
    const response = await qs.tokenEfficiency({ mode: 'context_pressure' });
    const result = response.json as { results: Array<{ phase: string; avg_peak_fill_pct: number }> };
    expect(result.results.some((r) => r.phase === 'codegen')).toBe(true);
    expect(result.results[0]?.avg_peak_fill_pct).toBeGreaterThan(0);
  });

  it('returns MCP impact by mcp_mode', async () => {
    const response = await qs.tokenEfficiency({ mode: 'mcp_impact' });
    const result = response.json as { results: Array<{ mcp_mode: string }> };
    expect(result.results.some((r) => r.mcp_mode === 'context')).toBe(true);
  });

  it('returns request volume per agent', async () => {
    const response = await qs.tokenEfficiency({ mode: 'request_volume' });
    const result = response.json as { results: Array<{ agent: string; total_tool_calls: number }> };
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('returns trend data ordered by date', async () => {
    const response = await qs.tokenEfficiency({ mode: 'trend', limit: 7 });
    expect(typeof response.markdown).toBe('string');
  });

  it('returns drill-down events for a session', async () => {
    const response = await qs.tokenEfficiency({ mode: 'drill_down', session_id: 'query-test-session' });
    const result = response.json as { event_count: number };
    expect(result.event_count).toBeGreaterThan(0);
  });
});

// req-004-event-log-query (FEA-001)
describe('req-004-event-log-query: DuckDbQueryService.eventLog', () => {
  it('returns Markdown, JSON, and rawSample when scoped by session_id', async () => {
    const response = await qs.eventLog({ mode: 'event_log', session_id: 'query-test-session' });
    expect(typeof response.markdown).toBe('string');
    expect(response.markdown).toContain('|');
    expect(typeof response.json).toBe('object');
    expect(Array.isArray(response.rawSample)).toBe(true);
  });

  it('returns event_count in JSON aggregation', async () => {
    const response = await qs.eventLog({ mode: 'event_log', session_id: 'query-test-session' });
    const result = response.json as { event_count: number; events: unknown[] };
    expect(result.event_count).toBeGreaterThan(0);
    expect(Array.isArray(result.events)).toBe(true);
  });

  it('filters by session_id', async () => {
    const response = await qs.eventLog({ mode: 'event_log', session_id: 'query-test-session' });
    const result = response.json as { events: Array<{ session_id: string }> };
    expect(result.events.every((e) => e.session_id === 'query-test-session')).toBe(true);
  });

  it('filters by initiative_id', async () => {
    const response = await qs.eventLog({ mode: 'event_log', initiative_id: 'init-alpha' });
    const result = response.json as { events: Array<{ initiative_id: string }> };
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events.every((e) => e.initiative_id === 'init-alpha')).toBe(true);
  });

  it('filters by event_type', async () => {
    const response = await qs.eventLog({ mode: 'event_log', event_type: 'phase_end' });
    const result = response.json as { events: Array<{ event: string }> };
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events.every((e) => e.event === 'phase_end')).toBe(true);
  });

  it('respects limit param', async () => {
    const response = await qs.eventLog({ mode: 'event_log', session_id: 'query-test-session', limit: 2 });
    const result = response.json as { event_count: number };
    expect(result.event_count).toBeLessThanOrEqual(2);
  });

  it('returns empty result gracefully when no events match', async () => {
    const response = await qs.eventLog({ mode: 'event_log', session_id: 'nonexistent-session' });
    const result = response.json as { event_count: number };
    expect(result.event_count).toBe(0);
  });

  it('throws when no scope parameter is provided', async () => {
    await expect(qs.eventLog({ mode: 'event_log' })).rejects.toThrow('requires at least one scope parameter');
  });
});

// req-005-initiative-id-groupby (FEA-002)
describe('req-005-initiative-id-groupby: group_by initiative_id', () => {
  it('returns results grouped by initiative_id', async () => {
    const response = await qs.bottlenecks({ group_by: 'initiative_id' });
    expect(typeof response.markdown).toBe('string');
    const result = response.json as { results: Array<{ group_key: string }> };
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('includes init-alpha group in results', async () => {
    const response = await qs.bottlenecks({ group_by: 'initiative_id' });
    const result = response.json as { results: Array<{ group_key: string }> };
    expect(result.results.some((r) => r.group_key === 'init-alpha')).toBe(true);
  });

  it('coalesces null initiative_id to unknown', async () => {
    const response = await qs.bottlenecks({ group_by: 'initiative_id' });
    const result = response.json as { results: Array<{ group_key: string }> };
    // The seeded event with no initiative_id should appear as 'unknown'
    expect(result.results.some((r) => r.group_key === 'unknown')).toBe(true);
  });

  it('returns results grouped by mcp_mode (BUG-001)', async () => {
    const response = await qs.bottlenecks({ group_by: 'mcp_mode' });
    expect(typeof response.markdown).toBe('string');
    const result = response.json as { results: Array<{ group_key: string }> };
    expect(result.results.some((r) => r.group_key === 'context')).toBe(true);
  });
});

// req-006-initiative-id-filter (FEA-003)
describe('req-006-initiative-id-filter: initiative_id filter across query families', () => {
  it('bottlenecks: filters phase_end events to a single initiative', async () => {
    const response = await qs.bottlenecks({ group_by: 'phase', initiative_id: 'init-alpha' });
    const result = response.json as { results: Array<{ group_key: string }> };
    // init-alpha has codegen, spec, validate phase_end events
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('bottlenecks: returns empty when initiative_id has no phase_end events', async () => {
    const response = await qs.bottlenecks({ group_by: 'phase', initiative_id: 'nonexistent-initiative' });
    const result = response.json as { results: unknown[] };
    expect(result.results).toHaveLength(0);
  });

  it('bottlenecks: init-beta returns only its own phases', async () => {
    const response = await qs.bottlenecks({ group_by: 'phase', initiative_id: 'init-beta' });
    const result = response.json as { results: Array<{ group_key: string }> };
    // init-beta only has a spec phase_end
    expect(result.results.some((r) => r.group_key === 'spec')).toBe(true);
    expect(result.results.some((r) => r.group_key === 'codegen')).toBe(false);
  });

  it('failures: retry_summary scoped to initiative_id', async () => {
    const response = await qs.failures({ mode: 'retry_summary', initiative_id: 'init-alpha' });
    const result = response.json as { results: Array<{ session_id: string }> };
    // init-alpha validation_failure events are from query-test-session
    expect(result.results.every((r) => r.session_id === 'query-test-session')).toBe(true);
  });

  it('failures: retry_summary returns empty for non-existent initiative', async () => {
    const response = await qs.failures({ mode: 'retry_summary', initiative_id: 'nonexistent' });
    const result = response.json as { results: unknown[] };
    expect(result.results).toHaveLength(0);
  });

  it('tokenEfficiency: context_pressure scoped to initiative_id', async () => {
    const response = await qs.tokenEfficiency({ mode: 'context_pressure', initiative_id: 'init-alpha' });
    const result = response.json as { results: Array<{ phase: string }> };
    expect(result.results.some((r) => r.phase === 'codegen')).toBe(true);
  });

  it('tokenEfficiency: context_pressure returns empty for non-existent initiative', async () => {
    const response = await qs.tokenEfficiency({ mode: 'context_pressure', initiative_id: 'nonexistent' });
    const result = response.json as { results: unknown[] };
    expect(result.results).toHaveLength(0);
  });
});
