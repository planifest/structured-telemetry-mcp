/**
 * Regression: query routing
 *
 * Covers dispatchQuery routing for all query families, including bug fixes
 * for BUG-001 (mcp_mode group_by), BUG-002 (failure_sequence session_id),
 * BUG-003 (drill_down session_id), and FEA-001 (event_log scoping).
 */

import { describe, it, expect, vi } from 'vitest';
import { dispatchQuery } from '../../src/server-factory.js';
import type { IQueryService, QueryResponse } from '../../src/query/query-service.js';

const MOCK_RESPONSE: QueryResponse = {
  markdown: '| col |\n|---|\n| val |\n',
  json: { results: [] },
  rawSample: [],
};

function mockQueryService(overrides: Partial<IQueryService> = {}): IQueryService {
  return {
    bottlenecks:     vi.fn().mockResolvedValue(MOCK_RESPONSE),
    failures:        vi.fn().mockResolvedValue(MOCK_RESPONSE),
    tokenEfficiency: vi.fn().mockResolvedValue(MOCK_RESPONSE),
    eventLog:        vi.fn().mockResolvedValue(MOCK_RESPONSE),
    ...overrides,
  };
}

// ── Bottleneck routing ────────────────────────────────────────────────────────

describe('bottleneck routing — group_by values', () => {
  const groupBys = ['phase', 'agent', 'tool', 'run_id', 'content_type', 'mcp_mode', 'initiative_id'];

  for (const group_by of groupBys) {
    it(`routes group_by: "${group_by}" to bottlenecks`, async () => {
      const qs = mockQueryService();
      await dispatchQuery(qs, { group_by });
      expect(qs.bottlenecks).toHaveBeenCalledWith({ group_by });
      expect(qs.failures).not.toHaveBeenCalled();
      expect(qs.tokenEfficiency).not.toHaveBeenCalled();
      expect(qs.eventLog).not.toHaveBeenCalled();
    });
  }
});

describe('R-009-class — invalid group_by rejected with a clear error', () => {
  it('throws for an invalid group_by value instead of reaching the DB layer', async () => {
    const qs = mockQueryService();
    await expect(dispatchQuery(qs, { group_by: 'event_type' })).rejects.toThrow(
      'Invalid group_by: "event_type". Valid values: phase, agent, tool, run_id, content_type, mcp_mode, initiative_id',
    );
    expect(qs.bottlenecks).not.toHaveBeenCalled();
  });

  it('throws for an empty-string group_by', async () => {
    const qs = mockQueryService();
    await expect(dispatchQuery(qs, { group_by: '' })).rejects.toThrow('Invalid group_by: ""');
  });
});

// ── Failure routing ───────────────────────────────────────────────────────────

describe('failure routing — mode values', () => {
  const modes = ['retry_summary', 'loop_candidates', 'failure_cluster'];

  for (const mode of modes) {
    it(`routes mode: "${mode}" to failures`, async () => {
      const qs = mockQueryService();
      await dispatchQuery(qs, { mode });
      expect(qs.failures).toHaveBeenCalledWith({ mode });
      expect(qs.bottlenecks).not.toHaveBeenCalled();
    });
  }
});

describe('BUG-002 — failure_sequence requires session_id', () => {
  it('throws without session_id', async () => {
    const qs = mockQueryService();
    await expect(dispatchQuery(qs, { mode: 'failure_sequence' })).rejects.toThrow('failure_sequence requires session_id');
  });

  it('throws with empty session_id', async () => {
    const qs = mockQueryService();
    await expect(dispatchQuery(qs, { mode: 'failure_sequence', session_id: '' })).rejects.toThrow('failure_sequence requires session_id');
  });

  it('routes to failures with valid session_id', async () => {
    const qs = mockQueryService();
    await dispatchQuery(qs, { mode: 'failure_sequence', session_id: 'valid-session' });
    expect(qs.failures).toHaveBeenCalledWith({ mode: 'failure_sequence', session_id: 'valid-session' });
  });
});

// ── Token efficiency routing ──────────────────────────────────────────────────

describe('token efficiency routing — mode values', () => {
  const modes = ['context_pressure', 'mcp_impact', 'request_volume', 'trend'];

  for (const mode of modes) {
    it(`routes mode: "${mode}" to tokenEfficiency`, async () => {
      const qs = mockQueryService();
      await dispatchQuery(qs, { mode });
      expect(qs.tokenEfficiency).toHaveBeenCalledWith({ mode });
      expect(qs.bottlenecks).not.toHaveBeenCalled();
    });
  }
});

describe('BUG-003 — drill_down requires session_id', () => {
  it('throws without session_id', async () => {
    const qs = mockQueryService();
    await expect(dispatchQuery(qs, { mode: 'drill_down' })).rejects.toThrow('drill_down requires session_id');
  });

  it('throws with empty session_id', async () => {
    const qs = mockQueryService();
    await expect(dispatchQuery(qs, { mode: 'drill_down', session_id: '' })).rejects.toThrow('drill_down requires session_id');
  });

  it('routes to tokenEfficiency with valid session_id', async () => {
    const qs = mockQueryService();
    await dispatchQuery(qs, { mode: 'drill_down', session_id: 'valid-session' });
    expect(qs.tokenEfficiency).toHaveBeenCalledWith({ mode: 'drill_down', session_id: 'valid-session' });
  });
});

// ── Event log routing ─────────────────────────────────────────────────────────

describe('FEA-001 — event_log routing and scoping', () => {
  it('throws without any scope parameter', async () => {
    const qs = mockQueryService();
    await expect(dispatchQuery(qs, { mode: 'event_log' })).rejects.toThrow('requires at least one scope parameter');
  });

  it('routes with session_id to eventLog', async () => {
    const qs = mockQueryService();
    await dispatchQuery(qs, { mode: 'event_log', session_id: 'test-session' });
    expect(qs.eventLog).toHaveBeenCalledWith({ mode: 'event_log', session_id: 'test-session' });
    expect(qs.failures).not.toHaveBeenCalled();
    expect(qs.bottlenecks).not.toHaveBeenCalled();
  });

  it('routes with initiative_id to eventLog', async () => {
    const qs = mockQueryService();
    await dispatchQuery(qs, { mode: 'event_log', initiative_id: 'init-alpha' });
    expect(qs.eventLog).toHaveBeenCalledWith({ mode: 'event_log', initiative_id: 'init-alpha' });
  });
});

// ── Unrecognised queries ──────────────────────────────────────────────────────

describe('unrecognised query shapes rejected', () => {
  it('throws for an empty query', async () => {
    const qs = mockQueryService();
    await expect(dispatchQuery(qs, {})).rejects.toThrow('Unrecognised query shape');
  });

  it('throws for an unknown field', async () => {
    const qs = mockQueryService();
    await expect(dispatchQuery(qs, { unknown_field: 'value' })).rejects.toThrow('Unrecognised query shape');
  });

  it('throws for an unknown mode string', async () => {
    const qs = mockQueryService();
    await expect(dispatchQuery(qs, { mode: 'not_a_real_mode' })).rejects.toThrow('Unrecognised query shape');
  });
});
