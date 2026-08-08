/**
 * 0000019 hardening of the MCP query_telemetry handler in server-factory.ts:
 *   req-005 — the handler runs the shared validation gate before dispatch
 *   req-006 — engine errors are redacted (no SQL, no stored values), carry a correlationId
 *   req-008 — assembled tool-result text is capped at a character budget
 *
 * These are the MCP-path counterparts of the same three requirements' HTTP-path
 * behaviour; the HTTP side is tested against a live server elsewhere.
 */

import { describe, it, expect, vi } from 'vitest';
import { createQueryTelemetryHandler } from '../../src/server-factory.js';
import type { IQueryService, QueryResponse } from '../../src/query/query-service.js';

function mockQueryService(overrides: Partial<IQueryService> = {}): IQueryService {
  const ok: QueryResponse = { markdown: '| x |', json: { results: [] }, rawSample: [] };
  return {
    bottlenecks: vi.fn().mockResolvedValue(ok),
    failures: vi.fn().mockResolvedValue(ok),
    tokenEfficiency: vi.fn().mockResolvedValue(ok),
    eventLog: vi.fn().mockResolvedValue(ok),
    distinctValues: vi.fn().mockResolvedValue(ok),
    ...overrides,
  };
}

const text = (r: { content: Array<{ text: string }> }) => r.content[0]!.text;

describe('req-005 (MCP path): shared validation gate runs before dispatch', () => {
  it('rejects an out-of-range limit with a field-named error, without dispatching', async () => {
    const eventLog = vi.fn();
    const handler = createQueryTelemetryHandler(mockQueryService({ eventLog }));
    const r = await handler({ query: { mode: 'event_log', limit: -5 } });
    const body = JSON.parse(text(r)) as { ok: boolean; errors: Array<{ field?: string }> };
    expect(body.ok).toBe(false);
    expect(body.errors.some((e) => e.field === 'limit')).toBe(true);
    expect(eventLog).not.toHaveBeenCalled();
  });

  it('rejects distinct_values limit 21 (reject, not clamp)', async () => {
    const handler = createQueryTelemetryHandler(mockQueryService());
    const body = JSON.parse(text(await handler({ query: { mode: 'distinct_values', field: 'agent', limit: 21 } }))) as { ok: boolean };
    expect(body.ok).toBe(false);
  });

  it('passes a valid query through to dispatch', async () => {
    const eventLog = vi.fn().mockResolvedValue({ markdown: 'ok', json: {}, rawSample: [] });
    const handler = createQueryTelemetryHandler(mockQueryService({ eventLog }));
    await handler({ query: { mode: 'event_log', limit: 10 } });
    expect(eventLog).toHaveBeenCalledOnce();
  });
});

describe('req-006 (MCP path): engine errors are redacted', () => {
  it('does not leak DuckDB text or stored values, and carries a correlationId', async () => {
    // Simulate the real leak: a binder error embedding SQL + a stored session_id value.
    const leak = new Error(
      "Binder Error: Referenced column \"NaN\" was not found\n\nLINE 9: LIMIT NaN\n" +
      "value '20654da2-5bf5-435f-90d1-a129a3291735' from column session_id",
    );
    const eventLog = vi.fn().mockRejectedValue(leak);
    const handler = createQueryTelemetryHandler(mockQueryService({ eventLog }));
    const raw = text(await handler({ query: { mode: 'event_log' } }));
    for (const forbidden of ['Binder Error', 'LINE ', 'session_id', '20654da2', 'LIMIT NaN']) {
      expect(raw).not.toContain(forbidden);
    }
    const body = JSON.parse(raw) as { ok: boolean; correlationId?: string };
    expect(body.ok).toBe(false);
    expect(typeof body.correlationId).toBe('string');
    expect(body.correlationId!.length).toBeGreaterThan(0);
  });
});

describe('req-008 (MCP path): tool-result text budget', () => {
  it('caps oversized text and states truncation, keeping every JSON block parseable', async () => {
    // A json payload far larger than the budget.
    const big = { results: Array.from({ length: 20000 }, (_, i) => ({ i, blob: 'x'.repeat(40) })) };
    const eventLog = vi.fn().mockResolvedValue({
      markdown: '## summary',
      json: big,
      rawSample: [{ a: 1 }],
    });
    const handler = createQueryTelemetryHandler(mockQueryService({ eventLog }));
    const raw = text(await handler({ query: { mode: 'event_log' }, budget: 5000 } as never));
    expect(raw.length).toBeLessThanOrEqual(5000);
    expect(raw.toLowerCase()).toContain('truncat');
    // every fenced json block that appears is closed (no half-serialised block)
    const fences = (raw.match(/```/g) ?? []).length;
    expect(fences % 2).toBe(0);
  });

  it('leaves a normal-sized result unchanged in the common case', async () => {
    const eventLog = vi.fn().mockResolvedValue({ markdown: '## small', json: { results: [1, 2, 3] }, rawSample: [] });
    const handler = createQueryTelemetryHandler(mockQueryService({ eventLog }));
    const raw = text(await handler({ query: { mode: 'event_log' } }));
    expect(raw).toContain('## small');
    expect(raw.toLowerCase()).not.toContain('truncat');
  });
});
