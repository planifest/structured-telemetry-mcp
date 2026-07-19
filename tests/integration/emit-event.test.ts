import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import type { DuckDBInstance } from '@duckdb/node-api';
import { openDatabase, closeDatabase } from '../../src/db/index.js';
import { DuckDbEventRepository } from '../../src/db/duckdb-event-repository.js';
import { validateEvent } from '../../src/validation/validate-event.js';
import { createEmitEventHandler } from '../../src/server-factory.js';

// req-001-emit-event: MCP tool that ingests a validated telemetry event into DuckDB.

const TEST_DB = join(tmpdir(), `telemetry-test-${Date.now()}.db`);

let repo: DuckDbEventRepository;

beforeAll(async () => {
  process.env['PLANIFEST_TELEMETRY_DB'] = TEST_DB;
  const db: DuckDBInstance = await openDatabase(TEST_DB);
  repo = new DuckDbEventRepository(db);
});

afterAll(() => {
  closeDatabase();
  try { rmSync(TEST_DB); } catch { /* best effort */ }
  delete process.env['PLANIFEST_TELEMETRY_DB'];
});

const VALID_EVENT = {
  schema_version: '1.0' as const,
  event: 'phase_start' as const,
  session_id: 'integration-test-session',
  phase: 'codegen' as const,
  agent: 'planifest-codegen-agent',
  tool: 'claude-code',
  model: 'claude-sonnet-4-6',
  mcp_mode: 'context' as const,
  timestamp: '2026-04-13T12:00:00Z',
  data: { phase_name: 'codegen' },
};

describe('req-001-emit-event: DuckDbEventRepository', () => {
  it('returns ok and a row id for a valid event', async () => {
    const result = await repo.write(VALID_EVENT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);
    }
  });

  it('persists the event so it can be retrieved by id', async () => {
    const writeResult = await repo.write(VALID_EVENT);
    expect(writeResult.ok).toBe(true);
    if (!writeResult.ok) return;

    const stored = await repo.findById(writeResult.id);
    expect(stored).not.toBeNull();
    expect(stored?.event).toBe('phase_start');
    expect(stored?.session_id).toBe('integration-test-session');
    expect(stored?.phase).toBe('codegen');
  });

  it('stores all 21 event types without error', async () => {
    const events = [
      { ...VALID_EVENT, event: 'phase_start' as const, data: { phase_name: 'spec' } },
      { ...VALID_EVENT, event: 'phase_end' as const, data: { phase_name: 'spec', status: 'pass' as const, duration_ms: 1500 } },
      { ...VALID_EVENT, event: 'spec_gap' as const, data: { question: 'What is the latency target?', phase_name: 'spec' } },
      { ...VALID_EVENT, event: 'validation_failure' as const, data: { failure_type: 'typecheck', phase_name: 'validate', attempt_number: 1, action_id: 'act-001' } },
      { ...VALID_EVENT, event: 'deviation' as const, data: { component_id: 'comp-a', description: 'Used alternative library', severity: 'low' as const } },
      { ...VALID_EVENT, event: 'migration_proposal' as const, data: { component_id: 'comp-a', proposal_path: 'src/comp-a/docs/migrations/proposed-add-col.md', destructive: false } },
      { ...VALID_EVENT, event: 'context_pressure' as const, data: { context_fill_pct: 78.5, unused_sources: ['file:foo.md'], trigger: 'threshold' } },
      { ...VALID_EVENT, event: 'mcp_impact' as const, data: { mcp_mode: 'context' as const, avg_token_delta: -800, peak_fill_pct: 52.0 } },
      { ...VALID_EVENT, event: 'self_correction' as const, data: { phase_name: 'codegen', attempt_number: 2, action_id: 'act-002', correction_type: 'lint-fix' } },
      { ...VALID_EVENT, event: 'phase_skip' as const, data: { phase_name: 'security', reason: 'No security-sensitive changes' } },
      { ...VALID_EVENT, event: 'security_finding' as const, data: { component_id: 'auth', title: 'SQL injection', severity: 'high' as const } },
      { ...VALID_EVENT, event: 'retry_limit_exceeded' as const, data: { phase_name: 'validate', action_id: 'act-003', attempt_count: 5 } },
      { ...VALID_EVENT, event: 'adr_decision' as const, data: { adr_id: 'ADR-010', title: 'Event log query family', chosen_option: 'Dedicated eventLog method' } },
      { ...VALID_EVENT, event: 'doc_gap' as const, data: { component_id: 'auth', description: 'Missing ADR for auth strategy' } },
      { ...VALID_EVENT, event: 'context_reset' as const, data: { phase_name: 'codegen', reason: 'compaction' } },
      { ...VALID_EVENT, event: 'approval_requested' as const, data: { phase_name: 'codegen', subject: 'drop column users.token', action_id: 'mig-003' } },
      { ...VALID_EVENT, event: 'fast_path_engaged' as const, data: { change_type: 'bug-fix', reason: 'isolated pure-function fix' } },
      { ...VALID_EVENT, event: 'test_failure' as const, data: { test_name: 'should return 404', phase_name: 'validate', attempt_number: 1 } },
      { ...VALID_EVENT, event: 'performance_regression' as const, data: { metric: 'p95_latency_ms', threshold: 50, actual: 73.4, phase_name: 'validate' } },
      { ...VALID_EVENT, event: 'dependency_blocked' as const, data: { phase_name: 'codegen', dependency: 'human: approve migration', reason: 'destructive op' } },
      { ...VALID_EVENT, event: 'schema_migration_applied' as const, data: { component_id: 'auth', migration_path: 'migrations/0003.sql', destructive: false } },
    ];

    for (const event of events) {
      const validation = validateEvent(event);
      expect(validation.isValid, `Event ${event.event} failed validation: ${validation.errors.join(', ')}`).toBe(true);

      const result = await repo.write(event);
      expect(result.ok, `Event ${event.event} failed write`).toBe(true);
    }
  });

  it('stores the initiative_id when provided', async () => {
    const event = { ...VALID_EVENT, initiative_id: '0000008-structured-telemetry-mcp-server' };
    const result = await repo.write(event);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const stored = await repo.findById(result.id);
    expect(stored?.initiative_id).toBe('0000008-structured-telemetry-mcp-server');
  });

  it('returns undefined initiative_id when not provided', async () => {
    const result = await repo.write(VALID_EVENT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = await repo.findById(result.id);
    expect(stored?.initiative_id).toBeUndefined();
  });

  it('stores and retrieves model_config round-trip', async () => {
    const event = { ...VALID_EVENT, model_config: { effort: 'high', thinking: true, budget_tokens: 8000 } };
    const result = await repo.write(event);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const stored = await repo.findById(result.id);
    expect(stored?.model_config).toEqual({ effort: 'high', thinking: true, budget_tokens: 8000 });
  });

  it('returns undefined model_config when not provided', async () => {
    const result = await repo.write(VALID_EVENT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = await repo.findById(result.id);
    expect(stored?.model_config).toBeUndefined();
  });

  it('returns null for a non-existent id', async () => {
    const stored = await repo.findById('00000000-0000-0000-0000-000000000000');
    expect(stored).toBeNull();
  });
});

// req-009/req-011: all 25 event types round-trip through the real MCP tool handler
// (not just the schema validator in isolation) — proves emit_event actually works
// end-to-end for every valid case, closing the R-009 fix's Definition of Done.
describe('req-009/req-011: emit_event handler — all 25 event types round-trip', () => {
  const allEvents: Array<[string, object]> = [
    ['phase_start', { phase_name: 'spec' }],
    ['phase_end', { phase_name: 'spec', status: 'pass', duration_ms: 1500 }],
    ['spec_gap', { question: 'What is the latency target?', phase_name: 'spec' }],
    ['validation_failure', { failure_type: 'typecheck', phase_name: 'validate', attempt_number: 1, action_id: 'act-001' }],
    ['deviation', { component_id: 'comp-a', description: 'Used alternative library', severity: 'low' }],
    ['migration_proposal', { component_id: 'comp-a', proposal_path: 'src/comp-a/docs/migrations/proposed-add-col.md', destructive: false }],
    ['context_pressure', { context_fill_pct: 78.5, unused_sources: ['file:foo.md'], trigger: 'threshold' }],
    ['mcp_impact', { mcp_mode: 'context', avg_token_delta: -800, peak_fill_pct: 52.0 }],
    ['self_correction', { phase_name: 'codegen', attempt_number: 2, action_id: 'act-002', correction_type: 'lint-fix' }],
    ['phase_skip', { phase_name: 'security', reason: 'No security-sensitive changes' }],
    ['security_finding', { component_id: 'auth', title: 'SQL injection', severity: 'high' }],
    ['retry_limit_exceeded', { phase_name: 'validate', action_id: 'act-003', attempt_count: 5 }],
    ['adr_decision', { adr_id: 'ADR-010', title: 'Event log query family', chosen_option: 'Dedicated eventLog method' }],
    ['doc_gap', { component_id: 'auth', description: 'Missing ADR for auth strategy' }],
    ['context_reset', { phase_name: 'codegen', reason: 'compaction' }],
    ['approval_requested', { phase_name: 'codegen', subject: 'drop column users.token', action_id: 'mig-003' }],
    ['fast_path_engaged', { change_type: 'bug-fix', reason: 'isolated pure-function fix' }],
    ['test_failure', { test_name: 'should return 404', phase_name: 'validate', attempt_number: 1 }],
    ['performance_regression', { metric: 'p95_latency_ms', threshold: 50, actual: 73.4, phase_name: 'validate' }],
    ['dependency_blocked', { phase_name: 'codegen', dependency: 'human: approve migration', reason: 'destructive op' }],
    ['schema_migration_applied', { component_id: 'auth', migration_path: 'migrations/0003.sql', destructive: false }],
    ['loop_iteration', { loop_id: 'design_critic', iteration: 1, cap: 3, decision: 'continue', toggle_level: 'on' }],
    ['phase_reversal_petitioned', { report: '002-schema-gap', filing_phase: 'P4', binding_artifact: 'plan/current/design.md' }],
    ['phase_reversal_granted', { report: '002-schema-gap', classification: 'additive', cascade_size: 1, budget_remaining: 1 }],
    ['phase_reversal_denied', { report: '002-schema-gap', classification: 'altering', cascade_size: 4, budget_remaining: 0 }],
  ];

  it(`accepts all ${allEvents.length} event types through the real emit_event handler`, async () => {
    expect(allEvents.length).toBe(25);
    const handler = createEmitEventHandler(repo);

    for (const [event, data] of allEvents) {
      const envelope = { ...VALID_EVENT, event, data };
      const result = await handler({ envelope });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.ok, `event ${event} failed: ${JSON.stringify(parsed.errors)}`).toBe(true);
    }
  });
});
