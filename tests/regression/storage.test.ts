/**
 * Regression: storage — DuckDB write and retrieve
 *
 * Confirms events written via DuckDbEventRepository are stored correctly
 * and retrievable by id. Uses an isolated temp DB per run.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import type { DuckDBInstance } from '@duckdb/node-api';
import { openDatabase, closeDatabase } from '../../src/db/index.js';
import { DuckDbEventRepository } from '../../src/db/duckdb-event-repository.js';

const TEST_DB = join(tmpdir(), `telemetry-storage-regression-${Date.now()}.db`);

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

const BASE = {
  schema_version: '1.0' as const,
  session_id: 'storage-regression-session',
  phase: 'codegen' as const,
  agent: 'planifest-codegen-agent',
  tool: 'claude-code',
  model: 'claude-sonnet-4-6',
  mcp_mode: 'context' as const,
  timestamp: '2026-04-13T12:00:00Z',
};

// ── Write + retrieve ──────────────────────────────────────────────────────────

describe('write and retrieve by id', () => {
  it('stores phase_end and retrieves correct fields', async () => {
    const result = await repo.write({
      ...BASE,
      event: 'phase_end',
      data: { phase_name: 'codegen', status: 'pass', duration_ms: 3200 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const stored = await repo.findById(result.id);
    expect(stored).not.toBeNull();
    expect(stored?.event).toBe('phase_end');
    expect(stored?.session_id).toBe('storage-regression-session');
    expect(stored?.phase).toBe('codegen');
  });

  it('stores security_finding and retrieves it', async () => {
    const result = await repo.write({
      ...BASE,
      event: 'security_finding',
      data: { component_id: 'auth', title: 'Open redirect', severity: 'medium' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const stored = await repo.findById(result.id);
    expect(stored).not.toBeNull();
    expect(stored?.event).toBe('security_finding');
  });

  it('stores adr_decision and retrieves it', async () => {
    const result = await repo.write({
      ...BASE,
      event: 'adr_decision',
      data: { adr_id: 'ADR-010', title: 'Event log query family', chosen_option: 'Dedicated eventLog method' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const stored = await repo.findById(result.id);
    expect(stored).not.toBeNull();
    expect(stored?.event).toBe('adr_decision');
  });

  it('returns null for a non-existent id', async () => {
    const stored = await repo.findById('00000000-0000-0000-0000-000000000000');
    expect(stored).toBeNull();
  });

  it('assigns unique ids to successive writes', async () => {
    const r1 = await repo.write({ ...BASE, event: 'phase_start', data: { phase_name: 'codegen' } });
    const r2 = await repo.write({ ...BASE, event: 'phase_start', data: { phase_name: 'codegen' } });
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r1.id).not.toBe(r2.id);
  });
});
