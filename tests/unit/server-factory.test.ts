import { describe, it, expect, vi } from 'vitest';
import {
  dispatchQuery,
  createEmitEventHandler,
  createQueryTelemetryHandler,
} from '../../src/server-factory.js';
import type { IEventRepository } from '../../src/db/repository.js';
import type { IQueryService, QueryResponse } from '../../src/query/query-service.js';

// ── Shared fixtures ───────────────────────────────────────────────────────────

const MOCK_RESPONSE: QueryResponse = {
  markdown: '| Phase |\n| --- |\n| codegen |\n',
  json: { results: [{ group_key: 'codegen' }] },
  rawSample: [],
};

const VALID_EVENT = {
  schema_version: '1.0' as const,
  event: 'phase_start' as const,
  session_id: 'unit-test-session',
  phase: 'codegen' as const,
  agent: 'planifest-codegen-agent',
  tool: 'claude-code',
  model: 'claude-sonnet-4-6',
  mcp_mode: 'context' as const,
  timestamp: '2026-04-13T12:00:00Z',
  data: { phase_name: 'codegen' },
};

function mockQueryService(overrides: Partial<IQueryService> = {}): IQueryService {
  return {
    bottlenecks: vi.fn().mockResolvedValue(MOCK_RESPONSE),
    failures: vi.fn().mockResolvedValue(MOCK_RESPONSE),
    tokenEfficiency: vi.fn().mockResolvedValue(MOCK_RESPONSE),
    eventLog: vi.fn().mockResolvedValue(MOCK_RESPONSE),
    ...overrides,
  };
}

function mockRepository(overrides: Partial<IEventRepository> = {}): IEventRepository {
  return {
    write: vi.fn().mockResolvedValue({ ok: true, id: 'mock-id-123' }),
    findById: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

// ── dispatchQuery ─────────────────────────────────────────────────────────────

describe('dispatchQuery', () => {
  it('routes group_by to bottlenecks', async () => {
    const qs = mockQueryService();
    await dispatchQuery(qs, { group_by: 'phase' });
    expect(qs.bottlenecks).toHaveBeenCalledWith({ group_by: 'phase' });
    expect(qs.failures).not.toHaveBeenCalled();
    expect(qs.tokenEfficiency).not.toHaveBeenCalled();
  });

  it('routes failure modes to failures', async () => {
    // failure_sequence requires session_id — tested separately in BUG-002 cases below
    const failureModes = ['retry_summary', 'loop_candidates', 'failure_cluster'];
    for (const mode of failureModes) {
      const qs = mockQueryService();
      await dispatchQuery(qs, { mode });
      expect(qs.failures).toHaveBeenCalledWith({ mode });
    }
  });

  it('routes token efficiency modes to tokenEfficiency', async () => {
    // drill_down requires session_id — tested separately in BUG-003 cases below
    const tokenModes = ['context_pressure', 'mcp_impact', 'request_volume', 'trend'];
    for (const mode of tokenModes) {
      const qs = mockQueryService();
      await dispatchQuery(qs, { mode });
      expect(qs.tokenEfficiency).toHaveBeenCalledWith({ mode });
    }
  });

  it('throws for an unrecognised query shape', async () => {
    const qs = mockQueryService();
    await expect(dispatchQuery(qs, { unknown_field: 'value' })).rejects.toThrow('Unrecognised query shape');
  });

  it('throws when mode is an unknown string (not a valid discriminator)', async () => {
    const qs = mockQueryService();
    await expect(dispatchQuery(qs, { mode: 'not_a_real_mode' })).rejects.toThrow('Unrecognised query shape');
  });

  it('throws when query is empty', async () => {
    const qs = mockQueryService();
    await expect(dispatchQuery(qs, {})).rejects.toThrow('Unrecognised query shape');
  });

  // req-001-schema-additions + req-002-bug-mcp-mode-groupby
  it('routes group_by: mcp_mode to bottlenecks (BUG-001)', async () => {
    const qs = mockQueryService();
    await dispatchQuery(qs, { group_by: 'mcp_mode' });
    expect(qs.bottlenecks).toHaveBeenCalledWith({ group_by: 'mcp_mode' });
    expect(qs.failures).not.toHaveBeenCalled();
    expect(qs.tokenEfficiency).not.toHaveBeenCalled();
  });

  it('routes group_by: initiative_id to bottlenecks (FEA-002)', async () => {
    const qs = mockQueryService();
    await dispatchQuery(qs, { group_by: 'initiative_id' });
    expect(qs.bottlenecks).toHaveBeenCalledWith({ group_by: 'initiative_id' });
  });

  // req-004-event-log-query (FEA-001)
  it('routes mode: event_log to eventLog before other checks', async () => {
    const qs = mockQueryService();
    await dispatchQuery(qs, { mode: 'event_log', session_id: 'test-session' });
    expect(qs.eventLog).toHaveBeenCalledWith({ mode: 'event_log', session_id: 'test-session' });
    expect(qs.failures).not.toHaveBeenCalled();
    expect(qs.tokenEfficiency).not.toHaveBeenCalled();
    expect(qs.bottlenecks).not.toHaveBeenCalled();
  });

  it('throws for event_log without scope params', async () => {
    const qs = mockQueryService();
    await expect(dispatchQuery(qs, { mode: 'event_log' })).rejects.toThrow('requires at least one scope parameter');
  });

  it('routes event_log with initiative_id scope', async () => {
    const qs = mockQueryService();
    await dispatchQuery(qs, { mode: 'event_log', initiative_id: 'init-alpha' });
    expect(qs.eventLog).toHaveBeenCalledWith({ mode: 'event_log', initiative_id: 'init-alpha' });
  });

  // req-003-bug-session-id-validation (BUG-002 + BUG-003)
  it('throws for failure_sequence without session_id (BUG-002)', async () => {
    const qs = mockQueryService();
    await expect(dispatchQuery(qs, { mode: 'failure_sequence' })).rejects.toThrow('failure_sequence requires session_id');
  });

  it('throws for failure_sequence with empty session_id (BUG-002)', async () => {
    const qs = mockQueryService();
    await expect(dispatchQuery(qs, { mode: 'failure_sequence', session_id: '' })).rejects.toThrow('failure_sequence requires session_id');
  });

  it('routes failure_sequence with valid session_id to failures (BUG-002 regression)', async () => {
    const qs = mockQueryService();
    await dispatchQuery(qs, { mode: 'failure_sequence', session_id: 'valid-session' });
    expect(qs.failures).toHaveBeenCalledWith({ mode: 'failure_sequence', session_id: 'valid-session' });
  });

  it('throws for drill_down without session_id (BUG-003)', async () => {
    const qs = mockQueryService();
    await expect(dispatchQuery(qs, { mode: 'drill_down' })).rejects.toThrow('drill_down requires session_id');
  });

  it('throws for drill_down with empty session_id (BUG-003)', async () => {
    const qs = mockQueryService();
    await expect(dispatchQuery(qs, { mode: 'drill_down', session_id: '' })).rejects.toThrow('drill_down requires session_id');
  });

  it('routes drill_down with valid session_id to tokenEfficiency (BUG-003 regression)', async () => {
    const qs = mockQueryService();
    await dispatchQuery(qs, { mode: 'drill_down', session_id: 'valid-session' });
    expect(qs.tokenEfficiency).toHaveBeenCalledWith({ mode: 'drill_down', session_id: 'valid-session' });
  });
});

// ── createEmitEventHandler ────────────────────────────────────────────────────

describe('createEmitEventHandler', () => {
  it('returns ok:false for an invalid event without calling repo.write', async () => {
    const repo = mockRepository();
    const handler = createEmitEventHandler(repo);
    const result = await handler({ event: null });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(false);
    expect(Array.isArray(parsed.errors)).toBe(true);
    expect(repo.write).not.toHaveBeenCalled();
  });

  it('returns ok:false for an empty object event', async () => {
    const repo = mockRepository();
    const handler = createEmitEventHandler(repo);
    const result = await handler({ event: {} });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(false);
  });

  it('calls repo.write and returns ok:true for a valid event', async () => {
    const repo = mockRepository();
    const handler = createEmitEventHandler(repo);
    const result = await handler({ event: VALID_EVENT });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(true);
    expect(parsed.id).toBe('mock-id-123');
    expect(repo.write).toHaveBeenCalledOnce();
  });

  it('returns ok:false when repo.write returns a WriteError', async () => {
    const repo = mockRepository({
      write: vi.fn().mockResolvedValue({ ok: false, errors: ['storage error'] }),
    });
    const handler = createEmitEventHandler(repo);
    const result = await handler({ event: VALID_EVENT });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(false);
    expect(parsed.errors).toContain('storage error');
  });

  it('surfaces the error when repo.write throws', async () => {
    const repo = mockRepository({
      write: vi.fn().mockRejectedValue(new Error('DB connection lost')),
    });
    const handler = createEmitEventHandler(repo);
    // Should propagate — the handler does not catch write errors itself
    await expect(handler({ event: VALID_EVENT })).rejects.toThrow('DB connection lost');
  });
});

// ── createQueryTelemetryHandler ───────────────────────────────────────────────

describe('createQueryTelemetryHandler', () => {
  it('returns formatted result sections for a valid query', async () => {
    const qs = mockQueryService();
    const handler = createQueryTelemetryHandler(qs);
    const result = await handler({ query: { group_by: 'phase' } });
    const text = result.content[0].text;
    expect(text).toContain('## Results');
    expect(text).toContain('## JSON');
    expect(text).toContain('## Raw Sample');
  });

  it('returns ok:false JSON for an unrecognised query shape', async () => {
    const qs = mockQueryService();
    const handler = createQueryTelemetryHandler(qs);
    const result = await handler({ query: { completely_unknown: true } });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(false);
    expect(parsed.errors[0]).toContain('query error');
  });

  it('returns ok:false JSON when the query service throws', async () => {
    const qs = mockQueryService({
      bottlenecks: vi.fn().mockRejectedValue(new Error('DuckDB offline')),
    });
    const handler = createQueryTelemetryHandler(qs);
    const result = await handler({ query: { group_by: 'phase' } });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(false);
    expect(parsed.errors[0]).toContain('DuckDB offline');
  });

  it('serialises BigInt values without throwing', async () => {
    const qs = mockQueryService({
      bottlenecks: vi.fn().mockResolvedValue({
        markdown: '_No results._\n',
        json: { count: BigInt(42) },
        rawSample: [],
      }),
    });
    const handler = createQueryTelemetryHandler(qs);
    const result = await handler({ query: { group_by: 'agent' } });
    // Should not throw; BigInt should be serialised as number
    expect(result.content[0].text).toContain('42');
  });
});
