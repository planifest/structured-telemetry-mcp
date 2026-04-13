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
  });
});
