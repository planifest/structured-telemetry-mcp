import { describe, it, expect } from 'vitest';
import { validateEvent } from '../../src/validation/validate-event.js';

// req-005-schema-validation: JSON Schema validation of all events at ingestion.

const BASE_ENVELOPE = {
  schema_version: '1.0',
  session_id: 'test-session-001',
  phase: 'codegen',
  agent: 'planifest-codegen-agent',
  tool: 'claude-code',
  model: 'claude-sonnet-4-6',
  mcp_mode: 'context',
  timestamp: '2026-04-13T12:00:00Z',
} as const;

describe('req-005-schema-validation: validateEvent', () => {
  describe('valid events are accepted', () => {
    it('accepts a valid phase_start event', () => {
      const result = validateEvent({
        ...BASE_ENVELOPE,
        event: 'phase_start',
        data: { phase_name: 'codegen' },
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts a valid phase_end event', () => {
      const result = validateEvent({
        ...BASE_ENVELOPE,
        event: 'phase_end',
        data: { phase_name: 'codegen', status: 'pass', duration_ms: 4200 },
      });
      expect(result.isValid).toBe(true);
    });

    it('accepts a phase_end event with optional content_type', () => {
      const result = validateEvent({
        ...BASE_ENVELOPE,
        event: 'phase_end',
        data: { phase_name: 'codegen', status: 'pass', duration_ms: 4200, content_type: 'code' },
      });
      expect(result.isValid).toBe(true);
    });

    it('accepts a valid validation_failure event', () => {
      const result = validateEvent({
        ...BASE_ENVELOPE,
        event: 'validation_failure',
        data: {
          failure_type: 'typecheck',
          phase_name: 'validate',
          attempt_number: 2,
          action_id: 'action-abc-123',
        },
      });
      expect(result.isValid).toBe(true);
    });

    it('accepts a valid context_pressure event', () => {
      const result = validateEvent({
        ...BASE_ENVELOPE,
        event: 'context_pressure',
        data: { context_fill_pct: 82.5, unused_sources: ['file:foo.md'], trigger: 'threshold' },
      });
      expect(result.isValid).toBe(true);
    });

    it('accepts a valid mcp_impact event', () => {
      const result = validateEvent({
        ...BASE_ENVELOPE,
        event: 'mcp_impact',
        data: { mcp_mode: 'context', avg_token_delta: -1200, peak_fill_pct: 45.0 },
      });
      expect(result.isValid).toBe(true);
    });

    it('accepts a valid deviation event', () => {
      const result = validateEvent({
        ...BASE_ENVELOPE,
        event: 'deviation',
        data: { component_id: 'structured-telemetry-mcp', description: 'Used duckdb instead of @duckdb/node-api', severity: 'low' },
      });
      expect(result.isValid).toBe(true);
    });

    it('accepts a valid migration_proposal event', () => {
      const result = validateEvent({
        ...BASE_ENVELOPE,
        event: 'migration_proposal',
        data: { component_id: 'structured-telemetry-mcp', proposal_path: 'src/.../proposed-add-index.md', destructive: false },
      });
      expect(result.isValid).toBe(true);
    });

    it('accepts a valid self_correction event', () => {
      const result = validateEvent({
        ...BASE_ENVELOPE,
        event: 'self_correction',
        data: { phase_name: 'validate', attempt_number: 3, action_id: 'action-xyz', correction_type: 'lint-fix' },
      });
      expect(result.isValid).toBe(true);
    });

    it('accepts an event with optional initiative_id', () => {
      const result = validateEvent({
        ...BASE_ENVELOPE,
        event: 'phase_start',
        initiative_id: '0000008-structured-telemetry-mcp-server',
        data: { phase_name: 'codegen' },
      });
      expect(result.isValid).toBe(true);
    });
  });

  describe('invalid events are rejected', () => {
    it('rejects an event missing session_id', () => {
      const { session_id: _, ...withoutSessionId } = BASE_ENVELOPE;
      const result = validateEvent({ ...withoutSessionId, event: 'phase_start', data: { phase_name: 'codegen' } });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('session_id'))).toBe(true);
    });

    it('rejects an unknown event type', () => {
      const result = validateEvent({ ...BASE_ENVELOPE, event: 'unknown_event' as never, data: {} });
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects a phase_end event missing status', () => {
      const result = validateEvent({
        ...BASE_ENVELOPE,
        event: 'phase_end',
        data: { phase_name: 'codegen', duration_ms: 4200 } as never,
      });
      expect(result.isValid).toBe(false);
    });

    it('rejects a validation_failure event with attempt_number below 1', () => {
      const result = validateEvent({
        ...BASE_ENVELOPE,
        event: 'validation_failure',
        data: { failure_type: 'typecheck', phase_name: 'validate', attempt_number: 0, action_id: 'abc' },
      });
      expect(result.isValid).toBe(false);
    });

    it('rejects a context_pressure event with context_fill_pct > 100', () => {
      const result = validateEvent({
        ...BASE_ENVELOPE,
        event: 'context_pressure',
        data: { context_fill_pct: 101, unused_sources: [], trigger: 'threshold' },
      });
      expect(result.isValid).toBe(false);
    });

    it('rejects an invalid mcp_mode on the envelope', () => {
      const result = validateEvent({
        ...BASE_ENVELOPE,
        mcp_mode: 'invalid' as never,
        event: 'phase_start',
        data: { phase_name: 'codegen' },
      });
      expect(result.isValid).toBe(false);
    });

    it('rejects an invalid timestamp format', () => {
      const result = validateEvent({
        ...BASE_ENVELOPE,
        timestamp: 'not-a-date',
        event: 'phase_start',
        data: { phase_name: 'codegen' },
      });
      expect(result.isValid).toBe(false);
    });

    it('returns structured errors with field paths', () => {
      const result = validateEvent({ ...BASE_ENVELOPE, event: 'phase_start', data: { phase_name: '' } });
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeInstanceOf(Array);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(typeof result.errors[0]).toBe('string');
    });

    // Non-object inputs
    it('rejects null', () => {
      expect(validateEvent(null).isValid).toBe(false);
    });
    it('rejects undefined', () => {
      expect(validateEvent(undefined).isValid).toBe(false);
    });
    it('rejects a plain string', () => {
      expect(validateEvent('phase_start').isValid).toBe(false);
    });
    it('rejects a number', () => {
      expect(validateEvent(42).isValid).toBe(false);
    });
    it('rejects an array', () => {
      expect(validateEvent([]).isValid).toBe(false);
    });
    it('rejects an empty object', () => {
      expect(validateEvent({}).isValid).toBe(false);
    });

    // Missing individual required envelope fields
    it('rejects missing agent', () => {
      const { agent: _, ...rest } = BASE_ENVELOPE;
      expect(validateEvent({ ...rest, event: 'phase_start', data: { phase_name: 'codegen' } }).isValid).toBe(false);
    });
    it('rejects missing tool', () => {
      const { tool: _, ...rest } = BASE_ENVELOPE;
      expect(validateEvent({ ...rest, event: 'phase_start', data: { phase_name: 'codegen' } }).isValid).toBe(false);
    });
    it('rejects missing model', () => {
      const { model: _, ...rest } = BASE_ENVELOPE;
      expect(validateEvent({ ...rest, event: 'phase_start', data: { phase_name: 'codegen' } }).isValid).toBe(false);
    });
    it('rejects missing phase', () => {
      const { phase: _, ...rest } = BASE_ENVELOPE;
      expect(validateEvent({ ...rest, event: 'phase_start', data: { phase_name: 'codegen' } }).isValid).toBe(false);
    });
    it('rejects wrong schema_version', () => {
      expect(validateEvent({ ...BASE_ENVELOPE, schema_version: '2.0', event: 'phase_start', data: { phase_name: 'codegen' } }).isValid).toBe(false);
    });

    // Per-event sad paths not previously covered
    it('rejects spec_gap with data that satisfies no oneOf branch', () => {
      // Note: data.oneOf is not discriminated by event type; each branch has required fields,
      // so an empty object fails all branches.
      expect(validateEvent({ ...BASE_ENVELOPE, event: 'spec_gap', data: {} as never }).isValid).toBe(false);
    });
    it('rejects deviation with invalid severity', () => {
      expect(validateEvent({ ...BASE_ENVELOPE, event: 'deviation', data: { component_id: 'x', description: 'y', severity: 'critical' } as never }).isValid).toBe(false);
    });
    it('rejects migration_proposal missing destructive', () => {
      expect(validateEvent({ ...BASE_ENVELOPE, event: 'migration_proposal', data: { component_id: 'x', proposal_path: 'y' } as never }).isValid).toBe(false);
    });
    it('rejects self_correction missing correction_type', () => {
      expect(validateEvent({ ...BASE_ENVELOPE, event: 'self_correction', data: { phase_name: 'codegen', attempt_number: 1, action_id: 'a' } as never }).isValid).toBe(false);
    });

    // Boundary values (valid extremes)
    it('accepts context_fill_pct at 0 (minimum)', () => {
      expect(validateEvent({ ...BASE_ENVELOPE, event: 'context_pressure', data: { context_fill_pct: 0, unused_sources: [], trigger: 't' } }).isValid).toBe(true);
    });
    it('accepts context_fill_pct at 100 (maximum)', () => {
      expect(validateEvent({ ...BASE_ENVELOPE, event: 'context_pressure', data: { context_fill_pct: 100, unused_sources: [], trigger: 't' } }).isValid).toBe(true);
    });
    it('accepts duration_ms at 0 (minimum)', () => {
      expect(validateEvent({ ...BASE_ENVELOPE, event: 'phase_end', data: { phase_name: 'codegen', status: 'pass', duration_ms: 0 } }).isValid).toBe(true);
    });
    it('accepts attempt_number at 1 (minimum)', () => {
      expect(validateEvent({ ...BASE_ENVELOPE, event: 'validation_failure', data: { failure_type: 'lint', phase_name: 'validate', attempt_number: 1, action_id: 'a' } }).isValid).toBe(true);
    });
  });
});
