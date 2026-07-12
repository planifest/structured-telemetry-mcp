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

// ── 0000009 new event types ───────────────────────────────────────────────────

describe('context_reset — required data fields', () => {
  it('rejects missing phase_name', () => {
    const result = validateEvent({ ...BASE, event: 'context_reset', data: { reason: 'compaction' } });
    expect(result.isValid).toBe(false);
  });
  it('rejects missing reason', () => {
    const result = validateEvent({ ...BASE, event: 'context_reset', data: { phase_name: 'codegen' } });
    expect(result.isValid).toBe(false);
  });
});

describe('approval_requested — required data fields', () => {
  it('rejects missing phase_name', () => {
    const result = validateEvent({ ...BASE, event: 'approval_requested', data: { subject: 'drop column', action_id: 'mig-001' } });
    expect(result.isValid).toBe(false);
  });
  it('rejects missing subject', () => {
    const result = validateEvent({ ...BASE, event: 'approval_requested', data: { phase_name: 'codegen', action_id: 'mig-001' } });
    expect(result.isValid).toBe(false);
  });
  it('rejects missing action_id', () => {
    const result = validateEvent({ ...BASE, event: 'approval_requested', data: { phase_name: 'codegen', subject: 'drop column' } });
    expect(result.isValid).toBe(false);
  });
});

describe('fast_path_engaged — required data fields', () => {
  it('rejects missing change_type', () => {
    const result = validateEvent({ ...BASE, event: 'fast_path_engaged', data: { reason: 'isolated fix' } });
    expect(result.isValid).toBe(false);
  });
  it('rejects missing reason', () => {
    const result = validateEvent({ ...BASE, event: 'fast_path_engaged', data: { change_type: 'bug-fix' } });
    expect(result.isValid).toBe(false);
  });
});

describe('test_failure — required data fields', () => {
  it('rejects missing test_name', () => {
    const result = validateEvent({ ...BASE, event: 'test_failure', data: { phase_name: 'validate', attempt_number: 1 } });
    expect(result.isValid).toBe(false);
  });
  it('rejects missing phase_name', () => {
    const result = validateEvent({ ...BASE, event: 'test_failure', data: { test_name: 'should 404', attempt_number: 1 } });
    expect(result.isValid).toBe(false);
  });
  it('rejects missing attempt_number', () => {
    const result = validateEvent({ ...BASE, event: 'test_failure', data: { test_name: 'should 404', phase_name: 'validate' } });
    expect(result.isValid).toBe(false);
  });
  it('accepts optional error_summary present', () => {
    const result = validateEvent({ ...BASE, event: 'test_failure', data: { test_name: 'should 404', phase_name: 'validate', attempt_number: 1, error_summary: 'expected 404 got 200' } });
    expect(result.isValid).toBe(true);
  });
  it('accepts optional error_summary absent', () => {
    const result = validateEvent({ ...BASE, event: 'test_failure', data: { test_name: 'should 404', phase_name: 'validate', attempt_number: 1 } });
    expect(result.isValid).toBe(true);
  });
});

describe('performance_regression — required data fields', () => {
  it('rejects missing metric', () => {
    const result = validateEvent({ ...BASE, event: 'performance_regression', data: { threshold: 50, actual: 73, phase_name: 'validate' } });
    expect(result.isValid).toBe(false);
  });
  it('rejects missing threshold', () => {
    const result = validateEvent({ ...BASE, event: 'performance_regression', data: { metric: 'p95', actual: 73, phase_name: 'validate' } });
    expect(result.isValid).toBe(false);
  });
  it('rejects missing actual', () => {
    const result = validateEvent({ ...BASE, event: 'performance_regression', data: { metric: 'p95', threshold: 50, phase_name: 'validate' } });
    expect(result.isValid).toBe(false);
  });
  it('rejects missing phase_name', () => {
    const result = validateEvent({ ...BASE, event: 'performance_regression', data: { metric: 'p95', threshold: 50, actual: 73 } });
    expect(result.isValid).toBe(false);
  });
});

describe('dependency_blocked — required data fields', () => {
  it('rejects missing phase_name', () => {
    const result = validateEvent({ ...BASE, event: 'dependency_blocked', data: { dependency: 'human approval', reason: 'destructive op' } });
    expect(result.isValid).toBe(false);
  });
  it('rejects missing dependency', () => {
    const result = validateEvent({ ...BASE, event: 'dependency_blocked', data: { phase_name: 'codegen', reason: 'destructive op' } });
    expect(result.isValid).toBe(false);
  });
  it('rejects missing reason', () => {
    const result = validateEvent({ ...BASE, event: 'dependency_blocked', data: { phase_name: 'codegen', dependency: 'human approval' } });
    expect(result.isValid).toBe(false);
  });
});

describe('schema_migration_applied — required data fields', () => {
  it('rejects missing component_id', () => {
    const result = validateEvent({ ...BASE, event: 'schema_migration_applied', data: { migration_path: 'migrations/001.sql', destructive: false } });
    expect(result.isValid).toBe(false);
  });
  it('rejects missing migration_path', () => {
    const result = validateEvent({ ...BASE, event: 'schema_migration_applied', data: { component_id: 'auth', destructive: false } });
    expect(result.isValid).toBe(false);
  });
  it('rejects missing destructive', () => {
    const result = validateEvent({ ...BASE, event: 'schema_migration_applied', data: { component_id: 'auth', migration_path: 'migrations/001.sql' } });
    expect(result.isValid).toBe(false);
  });
  it('accepts destructive: true', () => {
    const result = validateEvent({ ...BASE, event: 'schema_migration_applied', data: { component_id: 'auth', migration_path: 'migrations/002.sql', destructive: true } });
    expect(result.isValid).toBe(true);
  });
});

// ── 0000010 new event types (req-011) ─────────────────────────────────────────

describe('loop_iteration — required data fields', () => {
  it('rejects missing loop_id', () => {
    const result = validateEvent({ ...BASE, event: 'loop_iteration', data: { iteration: 1, cap: 3, decision: 'continue', toggle_level: 'on' } });
    expect(result.isValid).toBe(false);
  });
  it('rejects missing iteration', () => {
    const result = validateEvent({ ...BASE, event: 'loop_iteration', data: { loop_id: 'design_critic', cap: 3, decision: 'continue', toggle_level: 'on' } });
    expect(result.isValid).toBe(false);
  });
  it('rejects missing cap', () => {
    const result = validateEvent({ ...BASE, event: 'loop_iteration', data: { loop_id: 'design_critic', iteration: 1, decision: 'continue', toggle_level: 'on' } });
    expect(result.isValid).toBe(false);
  });
  it('rejects missing decision', () => {
    const result = validateEvent({ ...BASE, event: 'loop_iteration', data: { loop_id: 'design_critic', iteration: 1, cap: 3, toggle_level: 'on' } });
    expect(result.isValid).toBe(false);
  });
  it('rejects missing toggle_level', () => {
    const result = validateEvent({ ...BASE, event: 'loop_iteration', data: { loop_id: 'design_critic', iteration: 1, cap: 3, decision: 'continue' } });
    expect(result.isValid).toBe(false);
  });
  it('rejects an invalid decision enum value', () => {
    const result = validateEvent({ ...BASE, event: 'loop_iteration', data: { loop_id: 'design_critic', iteration: 1, cap: 3, decision: 'maybe', toggle_level: 'on' } });
    expect(result.isValid).toBe(false);
  });
});

describe('phase_reversal_petitioned — required data fields', () => {
  it('rejects missing report', () => {
    const result = validateEvent({ ...BASE, event: 'phase_reversal_petitioned', data: { filing_phase: 'P4', binding_artifact: 'plan/current/design.md' } });
    expect(result.isValid).toBe(false);
  });
  it('rejects missing filing_phase', () => {
    const result = validateEvent({ ...BASE, event: 'phase_reversal_petitioned', data: { report: '001-schema-gap', binding_artifact: 'plan/current/design.md' } });
    expect(result.isValid).toBe(false);
  });
  it('rejects missing binding_artifact', () => {
    const result = validateEvent({ ...BASE, event: 'phase_reversal_petitioned', data: { report: '001-schema-gap', filing_phase: 'P4' } });
    expect(result.isValid).toBe(false);
  });
});

describe('phase_reversal_granted — required data fields', () => {
  it('rejects missing classification', () => {
    const result = validateEvent({ ...BASE, event: 'phase_reversal_granted', data: { report: '001-schema-gap', cascade_size: 2, budget_remaining: 1 } });
    expect(result.isValid).toBe(false);
  });
  it('rejects missing cascade_size', () => {
    const result = validateEvent({ ...BASE, event: 'phase_reversal_granted', data: { report: '001-schema-gap', classification: 'additive', budget_remaining: 1 } });
    expect(result.isValid).toBe(false);
  });
  it('rejects missing budget_remaining', () => {
    const result = validateEvent({ ...BASE, event: 'phase_reversal_granted', data: { report: '001-schema-gap', classification: 'additive', cascade_size: 2 } });
    expect(result.isValid).toBe(false);
  });
  it('rejects an invalid classification enum value', () => {
    const result = validateEvent({ ...BASE, event: 'phase_reversal_granted', data: { report: '001-schema-gap', classification: 'moderate', cascade_size: 2, budget_remaining: 1 } });
    expect(result.isValid).toBe(false);
  });
});

describe('phase_reversal_denied — required data fields', () => {
  it('rejects missing report', () => {
    const result = validateEvent({ ...BASE, event: 'phase_reversal_denied', data: { classification: 'additive', cascade_size: 2, budget_remaining: 1 } });
    expect(result.isValid).toBe(false);
  });
  it('accepts a valid denied payload', () => {
    const result = validateEvent({ ...BASE, event: 'phase_reversal_denied', data: { report: '001-schema-gap', classification: 'altering', cascade_size: 5, budget_remaining: 0 } });
    expect(result.isValid).toBe(true);
  });
});
