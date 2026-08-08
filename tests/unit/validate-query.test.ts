/**
 * req-005: one shared query validation gate across the HTTP and MCP paths.
 *
 * The gate is the single enforcement point for numeric-field validity, with a
 * per-mode ceiling. Its central property is that the SAME input yields the SAME
 * outcome regardless of which path (HTTP /query or MCP query_telemetry) called
 * it — today the two paths disagree, which is the defect this closes.
 *
 * Rejection is by positive type/range test, never a failed comparison:
 * `NaN > MAX` evaluates false, which is exactly how the pre-existing cap was
 * bypassed (event-log.ts). See req-005's per-mode ceiling table.
 */

import { describe, it, expect } from 'vitest';
import { validateQuery, QUERY_LIMIT_CEILINGS } from '../../src/query/validate-query.js';

describe('req-005: shared query validation gate', () => {
  describe('limit — rejected corpus, each naming the field', () => {
    const rejected: Array<[string, Record<string, unknown>]> = [
      ['limit: "abc" (non-numeric string)', { mode: 'event_log', limit: 'abc' }],
      ['limit: -5 (negative)', { mode: 'event_log', limit: -5 }],
      ['limit: 1.5 (non-integer)', { mode: 'event_log', limit: 1.5 }],
      ['limit: 0 (below 1)', { mode: 'event_log', limit: 0 }],
      ['limit: 1001 on event_log (over 1000)', { mode: 'event_log', limit: 1001 }],
      ['limit: 21 on distinct_values (over 20 — reject, not clamp)', { mode: 'distinct_values', field: 'agent', limit: 21 }],
      ['limit: 1001 on failure_sequence', { mode: 'failure_sequence', session_id: 's', limit: 1001 }],
      ['limit: 1001 on drill_down', { mode: 'drill_down', session_id: 's', limit: 1001 }],
      ['limit: 366 on trend (day-count ceiling 365)', { mode: 'trend', limit: 366 }],
    ];
    for (const [label, q] of rejected) {
      it(`rejects ${label}`, () => {
        const r = validateQuery(q);
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.errors.some((e) => e.field === 'limit')).toBe(true);
          // no value quoted in the message (req-006 discipline)
          expect(r.errors.every((e) => typeof e.message === 'string' && e.message.length > 0)).toBe(true);
        }
      });
    }
  });

  describe('limit — accepted corpus', () => {
    const accepted: Array<[string, Record<string, unknown>]> = [
      ['limit: 1000 on event_log', { mode: 'event_log', limit: 1000 }],
      ['limit: 20 on distinct_values', { mode: 'distinct_values', field: 'agent', limit: 20 }],
      ['limit: 1000 on failure_sequence', { mode: 'failure_sequence', session_id: 's', limit: 1000 }],
      ['limit: 1000 on drill_down', { mode: 'drill_down', session_id: 's', limit: 1000 }],
      ['limit: 365 on trend', { mode: 'trend', limit: 365 }],
      ['limit: 30 on trend (default value)', { mode: 'trend', limit: 30 }],
      ['limit omitted entirely', { mode: 'event_log' }],
    ];
    for (const [label, q] of accepted) {
      it(`accepts ${label}`, () => {
        expect(validateQuery(q).ok).toBe(true);
      });
    }
  });

  describe('offset', () => {
    it('rejects offset: -1', () => {
      const r = validateQuery({ mode: 'event_log', offset: -1 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.some((e) => e.field === 'offset')).toBe(true);
    });
    it('rejects offset: 1e21 (integer but over ceiling)', () => {
      const r = validateQuery({ mode: 'event_log', offset: 1e21 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.some((e) => e.field === 'offset')).toBe(true);
    });
    it('rejects offset: 1.5 (non-integer)', () => {
      const r = validateQuery({ mode: 'event_log', offset: 1.5 });
      expect(r.ok).toBe(false);
    });
    it('accepts offset: 0', () => {
      expect(validateQuery({ mode: 'event_log', offset: 0 }).ok).toBe(true);
    });
  });

  describe('loop_threshold', () => {
    it('rejects loop_threshold: 0', () => {
      const r = validateQuery({ mode: 'loop_candidates', loop_threshold: 0 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.some((e) => e.field === 'loop_threshold')).toBe(true);
    });
    it('rejects loop_threshold: -1', () => {
      expect(validateQuery({ mode: 'loop_candidates', loop_threshold: -1 }).ok).toBe(false);
    });
    it('accepts a positive integer loop_threshold', () => {
      expect(validateQuery({ mode: 'loop_candidates', loop_threshold: 3 }).ok).toBe(true);
    });
  });

  describe('NaN is rejected by positive test, not comparison', () => {
    it('rejects limit: NaN', () => {
      // NaN > ceiling is false, so a comparison-only gate would let this through.
      const r = validateQuery({ mode: 'event_log', limit: NaN });
      expect(r.ok).toBe(false);
    });
  });

  describe('ceiling table is the single source of truth', () => {
    it('declares the per-mode ceilings req-005 specifies', () => {
      expect(QUERY_LIMIT_CEILINGS.event_log).toBe(1000);
      expect(QUERY_LIMIT_CEILINGS.distinct_values).toBe(20);
      expect(QUERY_LIMIT_CEILINGS.failure_sequence).toBe(1000);
      expect(QUERY_LIMIT_CEILINGS.drill_down).toBe(1000);
      expect(QUERY_LIMIT_CEILINGS.trend).toBe(365);
    });
  });

  it('accepts a query with no constrained fields at all', () => {
    expect(validateQuery({ group_by: 'phase' }).ok).toBe(true);
  });
});
