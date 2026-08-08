import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import {
  dispatchQuery,
  createEmitEventHandler,
  createQueryTelemetryHandler,
  EmitEventEnvelope,
  QueryShape,
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
    distinctValues: vi.fn().mockResolvedValue(MOCK_RESPONSE),
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

  // 0000015 ADR-016: no scope parameter is required — dispatchQuery no longer
  // pre-checks this itself; eventLog() bounds every request by limit/offset alone.
  it('routes event_log with no scope params to eventLog (ADR-016)', async () => {
    const qs = mockQueryService();
    await dispatchQuery(qs, { mode: 'event_log' });
    expect(qs.eventLog).toHaveBeenCalledWith({ mode: 'event_log' });
  });

  it('routes event_log with initiative_id scope', async () => {
    const qs = mockQueryService();
    await dispatchQuery(qs, { mode: 'event_log', initiative_id: 'init-alpha' });
    expect(qs.eventLog).toHaveBeenCalledWith({ mode: 'event_log', initiative_id: 'init-alpha' });
  });

  // req-002-filter-combobox-suggestions (0000017)
  it('routes mode: distinct_values to distinctValues', async () => {
    const qs = mockQueryService();
    await dispatchQuery(qs, { mode: 'distinct_values', field: 'agent' });
    expect(qs.distinctValues).toHaveBeenCalledWith({ mode: 'distinct_values', field: 'agent' });
    expect(qs.eventLog).not.toHaveBeenCalled();
    expect(qs.failures).not.toHaveBeenCalled();
    expect(qs.tokenEfficiency).not.toHaveBeenCalled();
    expect(qs.bottlenecks).not.toHaveBeenCalled();
  });

  it('routes mode: distinct_values with a q param through to distinctValues', async () => {
    const qs = mockQueryService();
    await dispatchQuery(qs, { mode: 'distinct_values', field: 'session_id', q: 'abc' });
    expect(qs.distinctValues).toHaveBeenCalledWith({ mode: 'distinct_values', field: 'session_id', q: 'abc' });
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
    const result = await handler({ envelope: null });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(false);
    expect(Array.isArray(parsed.errors)).toBe(true);
    expect(repo.write).not.toHaveBeenCalled();
  });

  it('returns ok:false for an empty object event', async () => {
    const repo = mockRepository();
    const handler = createEmitEventHandler(repo);
    const result = await handler({ envelope: {} });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(false);
  });

  it('calls repo.write and returns ok:true for a valid event', async () => {
    const repo = mockRepository();
    const handler = createEmitEventHandler(repo);
    const result = await handler({ envelope: VALID_EVENT });
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
    const result = await handler({ envelope: VALID_EVENT });
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
    await expect(handler({ envelope: VALID_EVENT })).rejects.toThrow('DB connection lost');
  });
});

// ── req-009: EmitEventEnvelope tool-argument schema ───────────────────────────

describe('req-009 — EmitEventEnvelope exposes a real object schema', () => {
  it('produces type: "object" with properties for every envelope field (regression guard against z.unknown())', () => {
    const jsonSchema = z.toJSONSchema(EmitEventEnvelope) as { type?: string; properties?: Record<string, unknown> };
    expect(jsonSchema.type).toBe('object');
    expect(jsonSchema.properties).toBeDefined();
    const props = Object.keys(jsonSchema.properties ?? {});
    for (const field of [
      'schema_version', 'event', 'session_id', 'initiative_id', 'phase',
      'agent', 'tool', 'model', 'mcp_mode', 'timestamp', 'model_config', 'data',
    ]) {
      expect(props).toContain(field);
    }
  });

  it('rejects an argument shape that is not a plain object (expected-object Zod error, not ajv\'s opaque message)', () => {
    const result = EmitEventEnvelope.safeParse('not-an-object');
    expect(result.success).toBe(false);
  });
});

// ── req-0000011-01: QueryShape tool-argument schema ───────────────────────────

describe('req-0000011-01 — QueryShape exposes a real object schema for query_telemetry', () => {
  it('produces type: "object" with properties for every known query field (regression guard against z.unknown())', () => {
    const jsonSchema = z.toJSONSchema(QueryShape) as { type?: string; properties?: Record<string, unknown> };
    expect(jsonSchema.type).toBe('object');
    expect(jsonSchema.properties).toBeDefined();
    const props = Object.keys(jsonSchema.properties ?? {});
    for (const field of ['group_by', 'mode', 'session_id', 'initiative_id', 'event_type', 'limit', 'loop_threshold']) {
      expect(props).toContain(field);
    }
  });

  it('rejects a non-object root value (string, null, array) — the R-009-class failure mode', () => {
    for (const badShape of ['not-an-object', null, [1, 2]]) {
      expect(QueryShape.safeParse(badShape).success).toBe(false);
    }
  });

  it('accepts an object with additional unrecognised keys (passthrough)', () => {
    const result = QueryShape.safeParse({ group_by: 'phase', some_future_field: 'x' });
    expect(result.success).toBe(true);
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

  it('returns a redacted ok:false JSON for an unrecognised query shape (req-006)', async () => {
    const qs = mockQueryService();
    const handler = createQueryTelemetryHandler(qs);
    const result = await handler({ query: { completely_unknown: true } });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(false);
    // req-006: the internal error is redacted to a generic message with a
    // correlationId; the pre-0000019 behaviour leaked the raw error text.
    expect(parsed.errors[0]).toBe('query failed');
    expect(typeof parsed.correlationId).toBe('string');
  });

  it('redacts an engine error rather than leaking it to the caller (req-006)', async () => {
    const qs = mockQueryService({
      bottlenecks: vi.fn().mockRejectedValue(new Error('DuckDB offline')),
    });
    const handler = createQueryTelemetryHandler(qs);
    const result = await handler({ query: { group_by: 'phase' } });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(false);
    // The engine string must NOT reach the caller — this test previously
    // asserted the opposite, which was the leak req-006 closes.
    expect(result.content[0].text).not.toContain('DuckDB offline');
    expect(parsed.errors[0]).toBe('query failed');
    expect(typeof parsed.correlationId).toBe('string');
  });

  // req-021–028: new event types through handler pipeline
  it('accepts context_reset through handler pipeline (REQ-022)', async () => {
    const repo = mockRepository();
    const handler = createEmitEventHandler(repo);
    const result = await handler({ envelope: { ...VALID_EVENT, event: 'context_reset', data: { phase_name: 'codegen', reason: 'compaction' } } });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(true);
    expect(repo.write).toHaveBeenCalledOnce();
  });

  // req-0000011-01: QueryShape tool-argument schema (same bug class as R-009/ADR-013)
  it('rejects a stringified query — same R-009-class bug, now fixed for query_telemetry (req-0000011-01)', async () => {
    const qs = mockQueryService();
    const handler = createQueryTelemetryHandler(qs);
    const result = await handler({ query: JSON.stringify({ group_by: 'phase' }) as unknown });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(false);
    expect(parsed.errors[0]).not.toContain('Unrecognised query shape');
    expect(qs.bottlenecks).not.toHaveBeenCalled();
  });

  it('rejects undefined/null/array query shapes with a specific error, not dispatchQuery\'s generic one (req-0000011-01)', async () => {
    const qs = mockQueryService();
    const handler = createQueryTelemetryHandler(qs);
    for (const badShape of [undefined, null, [{ group_by: 'phase' }]]) {
      const result = await handler({ query: badShape as unknown });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.ok).toBe(false);
      expect(parsed.errors[0]).not.toContain('Unrecognised query shape');
    }
  });

  it('still accepts an object with unrecognised keys (passthrough — dispatchQuery remains the semantic validator) (req-0000011-01)', async () => {
    const qs = mockQueryService();
    const handler = createQueryTelemetryHandler(qs);
    const result = await handler({ query: { completely_unknown: true } });
    const parsed = JSON.parse(result.content[0].text);
    // The object still passes the shape gate and reaches dispatchQuery (the
    // point of this test); dispatchQuery's throw is now redacted (req-006), so
    // we assert ok:false + no leaked engine text rather than the old message.
    expect(parsed.ok).toBe(false);
    expect(result.content[0].text).not.toContain('Unrecognised query shape');
    expect(parsed.errors[0]).toBe('query failed');
    expect(qs.bottlenecks).not.toHaveBeenCalled();
  });

  it('rejects context_reset missing reason — does not call repo.write (REQ-022)', async () => {
    const repo = mockRepository();
    const handler = createEmitEventHandler(repo);
    const result = await handler({ envelope: { ...VALID_EVENT, event: 'context_reset', data: { phase_name: 'codegen' } } });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(false);
    expect(repo.write).not.toHaveBeenCalled();
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
