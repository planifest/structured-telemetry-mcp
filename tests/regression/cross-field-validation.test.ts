/**
 * Regression: cross-field validation
 *
 * Each event type's required data fields enforced — missing or invalid
 * fields on data must be rejected with a structured error.
 * Tests validateEvent() in isolation — no DB, no server.
 */

import { describe, it, expect } from 'vitest';
import { validateEvent } from '../../src/validation/validate-event.js';

const BASE = {
  schema_version: '1.0' as const,
  session_id: 'regression-session',
  phase: 'codegen' as const,
  agent: 'planifest-codegen-agent',
  tool: 'claude-code',
  model: 'claude-sonnet-4-6',
  mcp_mode: 'context' as const,
  timestamp: '2026-04-13T12:00:00Z',
};

describe('phase_end — required data fields', () => {
  it('rejects missing status', () => {
    const result = validateEvent({ ...BASE, event: 'phase_end', data: { phase_name: 'codegen', duration_ms: 1200 } });
    expect(result.isValid).toBe(false);
  });

  it('rejects missing duration_ms', () => {
    const result = validateEvent({ ...BASE, event: 'phase_end', data: { phase_name: 'codegen', status: 'pass' } });
    expect(result.isValid).toBe(false);
  });

  it('rejects missing phase_name', () => {
    const result = validateEvent({ ...BASE, event: 'phase_end', data: { status: 'pass', duration_ms: 1200 } });
    expect(result.isValid).toBe(false);
  });
});

describe('phase_skip — required data fields', () => {
  it('rejects missing reason', () => {
    const result = validateEvent({ ...BASE, event: 'phase_skip', data: { phase_name: 'security' } });
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('reason');
  });

  it('rejects missing phase_name', () => {
    const result = validateEvent({ ...BASE, event: 'phase_skip', data: { reason: 'no changes' } });
    expect(result.isValid).toBe(false);
  });
});

describe('validation_failure — required data fields', () => {
  it('rejects missing action_id', () => {
    const result = validateEvent({ ...BASE, event: 'validation_failure', data: { failure_type: 'lint', phase_name: 'validate', attempt_number: 1 } });
    expect(result.isValid).toBe(false);
  });

  it('rejects missing attempt_number', () => {
    const result = validateEvent({ ...BASE, event: 'validation_failure', data: { failure_type: 'lint', phase_name: 'validate', action_id: 'act-001' } });
    expect(result.isValid).toBe(false);
  });
});

describe('deviation — enum constraints', () => {
  it('rejects invalid severity', () => {
    const result = validateEvent({ ...BASE, event: 'deviation', data: { component_id: 'auth', description: 'x', severity: 'catastrophic' } });
    expect(result.isValid).toBe(false);
  });
});

describe('migration_proposal — required data fields', () => {
  it('rejects missing destructive flag', () => {
    const result = validateEvent({ ...BASE, event: 'migration_proposal', data: { component_id: 'auth', proposal_path: 'migrations/001.sql' } });
    expect(result.isValid).toBe(false);
  });
});

describe('security_finding — enum constraints', () => {
  it('rejects invalid severity', () => {
    const result = validateEvent({ ...BASE, event: 'security_finding', data: { component_id: 'auth', title: 'SQLi', severity: 'extreme' } });
    expect(result.isValid).toBe(false);
  });
});

describe('self_correction — required data fields', () => {
  it('rejects missing correction_type', () => {
    const result = validateEvent({ ...BASE, event: 'self_correction', data: { phase_name: 'codegen', attempt_number: 1, action_id: 'act-001' } });
    expect(result.isValid).toBe(false);
  });
});

describe('adr_decision — required data fields', () => {
  it('rejects missing chosen_option', () => {
    const result = validateEvent({ ...BASE, event: 'adr_decision', data: { adr_id: 'ADR-001', title: 'Something' } });
    expect(result.isValid).toBe(false);
  });
});
