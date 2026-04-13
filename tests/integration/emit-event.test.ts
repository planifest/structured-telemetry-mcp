import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { openDatabase, closeDatabase } from '../../src/db/index.js';
import { writeEvent, findEventById } from '../../src/db/events-repository.js';
import { validateEvent } from '../../src/validation/validate-event.js';

// req-001-emit-event: MCP tool that ingests a validated telemetry event into DuckDB.

const TEST_DB = join(tmpdir(), `telemetry-test-${Date.now()}.db`);

beforeAll(async () => {
  process.env['PLANIFEST_TELEMETRY_DB'] = TEST_DB;
  await openDatabase(TEST_DB);
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

describe('req-001-emit-event: writeEvent', () => {
  it('returns ok and a row id for a valid event', async () => {
    const result = await writeEvent(VALID_EVENT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);
    }
  });

  it('persists the event so it can be retrieved by id', async () => {
    const writeResult = await writeEvent(VALID_EVENT);
    expect(writeResult.ok).toBe(true);
    if (!writeResult.ok) return;

    const stored = await findEventById(writeResult.id);
    expect(stored).not.toBeNull();
    expect(stored?.event).toBe('phase_start');
    expect(stored?.session_id).toBe('integration-test-session');
    expect(stored?.phase).toBe('codegen');
  });

  it('stores all 9 event types without error', async () => {
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
    ];

    for (const event of events) {
      const validation = validateEvent(event);
      expect(validation.isValid, `Event ${event.event} failed validation: ${validation.errors.join(', ')}`).toBe(true);

      const result = await writeEvent(event);
      expect(result.ok, `Event ${event.event} failed write: ${!result.ok ? result.errors.join(', ') : ''}`).toBe(true);
    }
  });

  it('stores the initiative_id when provided', async () => {
    const event = { ...VALID_EVENT, initiative_id: '0000008-structured-telemetry-mcp-server' };
    const result = await writeEvent(event);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const stored = await findEventById(result.id);
    expect(stored?.initiative_id).toBe('0000008-structured-telemetry-mcp-server');
  });
});
