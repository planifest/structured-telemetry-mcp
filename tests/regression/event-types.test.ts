/**
 * Regression: event types
 *
 * Every known event type accepted with a valid minimal payload.
 * Unknown event types rejected.
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

describe('known event types — valid minimal payloads accepted', () => {
  const cases: Array<[string, object]> = [
    ['phase_start',          { phase_name: 'codegen' }],
    ['phase_end',            { phase_name: 'codegen', status: 'pass', duration_ms: 1200 }],
    ['spec_gap',             { question: 'What is the latency target?', phase_name: 'spec' }],
    ['validation_failure',   { failure_type: 'lint', phase_name: 'validate', attempt_number: 1, action_id: 'act-001' }],
    ['deviation',            { component_id: 'auth', description: 'Used JWT instead of session', severity: 'low' }],
    ['migration_proposal',   { component_id: 'auth', proposal_path: 'migrations/001.sql', destructive: false }],
    ['context_pressure',     { context_fill_pct: 82, unused_sources: ['README.md'], trigger: 'tool_call' }],
    ['mcp_impact',           { mcp_mode: 'context', avg_token_delta: 1200, peak_fill_pct: 74 }],
    ['self_correction',      { phase_name: 'codegen', attempt_number: 2, action_id: 'act-002', correction_type: 'revert' }],
    ['phase_skip',           { phase_name: 'security', reason: 'No security-sensitive changes' }],
    ['security_finding',     { component_id: 'auth', title: 'SQL injection in search', severity: 'high' }],
    ['retry_limit_exceeded', { phase_name: 'validate', action_id: 'act-003', attempt_count: 5 }],
    ['adr_decision',         { adr_id: 'ADR-010', title: 'Event log query family', chosen_option: 'Dedicated eventLog method' }],
    ['doc_gap',              { component_id: 'auth', description: 'Missing ADR for auth strategy' }],
    // 0000009 — 7 new event types
    ['context_reset',           { phase_name: 'codegen', reason: 'compaction' }],
    ['approval_requested',      { phase_name: 'codegen', subject: 'drop column users.token', action_id: 'mig-003' }],
    ['fast_path_engaged',       { change_type: 'bug-fix', reason: 'isolated pure-function fix' }],
    ['test_failure',            { test_name: 'should return 404', phase_name: 'validate', attempt_number: 1 }],
    ['performance_regression',  { metric: 'p95_latency_ms', threshold: 50, actual: 73.4, phase_name: 'validate' }],
    ['dependency_blocked',      { phase_name: 'codegen', dependency: 'human: approve migration', reason: 'destructive op requires consent' }],
    ['schema_migration_applied',{ component_id: 'auth-service', migration_path: 'migrations/0003.sql', destructive: false }],
  ];

  for (const [event, data] of cases) {
    it(`accepts ${event}`, () => {
      const result = validateEvent({ ...BASE, event, data });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  }
});

describe('unknown event types — rejected', () => {
  it('rejects an unknown event type', () => {
    const result = validateEvent({ ...BASE, event: 'not_a_real_event', data: {} });
    expect(result.isValid).toBe(false);
  });
});
