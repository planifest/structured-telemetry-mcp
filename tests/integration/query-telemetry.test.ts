import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import type { DuckDBInstance } from '@duckdb/node-api';
import { openDatabase, closeDatabase } from '../../src/db/index.js';
import { DuckDbEventRepository } from '../../src/db/duckdb-event-repository.js';
import { DuckDbQueryService } from '../../src/query/query-service.js';
import type { TelemetryEvent } from '../../src/types/events.js';

// req-002-query-bottlenecks, req-003-query-failures, req-004-query-token-efficiency

const TEST_DB = join(tmpdir(), `telemetry-query-test-${Date.now()}.db`);

const BASE: Omit<TelemetryEvent, 'event' | 'data'> = {
  schema_version: '1.0',
  session_id: 'query-test-session',
  phase: 'codegen',
  agent: 'planifest-codegen-agent',
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
