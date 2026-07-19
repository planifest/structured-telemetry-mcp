/**
 * Regression: emit handler pipeline
 *
 * Covers createEmitEventHandler — validation gate, repo.write call behaviour,
 * and response shape for valid, invalid, and error cases.
 */

import { describe, it, expect, vi } from 'vitest';
import { createEmitEventHandler } from '../../src/server-factory.js';
import type { IEventRepository } from '../../src/db/repository.js';

function mockRepository(overrides: Partial<IEventRepository> = {}): IEventRepository {
  return {
    write:    vi.fn().mockResolvedValue({ ok: true, id: 'regression-id' }),
    findById: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

const VALID_EVENT = {
  schema_version: '1.0' as const,
  event: 'phase_start' as const,
  session_id: 'regression-session',
  phase: 'codegen' as const,
  agent: 'planifest-codegen-agent',
  tool: 'claude-code',
  model: 'claude-sonnet-4-6',
  mcp_mode: 'context' as const,
  timestamp: '2026-04-13T12:00:00Z',
  data: { phase_name: 'codegen' },
};

// ── Validation gate ───────────────────────────────────────────────────────────

describe('validation gate — invalid events do not reach repo.write', () => {
  it('returns ok:false and skips write for a null event', async () => {
    const repo = mockRepository();
    const handler = createEmitEventHandler(repo);
    const result = await handler({ envelope: null });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(false);
    expect(Array.isArray(parsed.errors)).toBe(true);
    expect(repo.write).not.toHaveBeenCalled();
  });

  it('returns ok:false and skips write for an empty object', async () => {
    const repo = mockRepository();
    const handler = createEmitEventHandler(repo);
    const result = await handler({ envelope: {} });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(false);
    expect(repo.write).not.toHaveBeenCalled();
  });

  it('returns ok:false and skips write for a cross-field violation (phase_skip missing reason)', async () => {
    const repo = mockRepository();
    const handler = createEmitEventHandler(repo);
    const result = await handler({ envelope: { ...VALID_EVENT, event: 'phase_skip', data: { phase_name: 'security' } } });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(false);
    expect(repo.write).not.toHaveBeenCalled();
  });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe('happy path — valid events reach repo.write', () => {
  it('calls repo.write once and returns ok:true with id', async () => {
    const repo = mockRepository();
    const handler = createEmitEventHandler(repo);
    const result = await handler({ envelope: VALID_EVENT });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(true);
    expect(parsed.id).toBe('regression-id');
    expect(repo.write).toHaveBeenCalledOnce();
  });
});

// ── Write failure propagation ─────────────────────────────────────────────────

describe('write failure propagation', () => {
  it('returns ok:false when repo.write returns a WriteError', async () => {
    const repo = mockRepository({
      write: vi.fn().mockResolvedValue({ ok: false, errors: ['storage error'] }),
    });
    const handler = createEmitEventHandler(repo);
    const result = await handler({ envelope: VALID_EVENT });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(false);
    expect(parsed.errors).toContain('storage error');
  });

  it('surfaces thrown errors from repo.write', async () => {
    const repo = mockRepository({
      write: vi.fn().mockRejectedValue(new Error('DB connection lost')),
    });
    const handler = createEmitEventHandler(repo);
    await expect(handler({ envelope: VALID_EVENT })).rejects.toThrow('DB connection lost');
  });
});

// ── req-010: malformed envelope reproduction cases (R-009 RCA) ────────────────

describe('req-010 — malformed envelope shapes rejected with a clear error', () => {
  it('case A: correct envelope object — passes', async () => {
    const repo = mockRepository();
    const handler = createEmitEventHandler(repo);
    const result = await handler({ envelope: VALID_EVENT });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(true);
  });

  it('case B: stringified envelope — rejected with a clear, specific error, not ajv\'s opaque "(root): must be object"', async () => {
    const repo = mockRepository();
    const handler = createEmitEventHandler(repo);
    const result = await handler({ envelope: JSON.stringify(VALID_EVENT) as unknown });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(false);
    expect(repo.write).not.toHaveBeenCalled();
    expect(parsed.errors[0]).not.toBe('(root): must be object');
    expect(parsed.errors[0]).toMatch(/expected object.*received string/i);
  });

  it('case C: undefined — rejected with a specific error', async () => {
    const repo = mockRepository();
    const handler = createEmitEventHandler(repo);
    const result = await handler({ envelope: undefined });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(false);
    expect(repo.write).not.toHaveBeenCalled();
    expect(parsed.errors[0]).not.toBe('(root): must be object');
  });

  it('case D: double-wrapped { event: envelope } — rejected with an error distinct from cases B/C/E/F', async () => {
    const repo = mockRepository();
    const handler = createEmitEventHandler(repo);
    const result = await handler({ envelope: { event: VALID_EVENT } as unknown });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(false);
    expect(repo.write).not.toHaveBeenCalled();
    // Distinct from the "expected object, received string" class of error (B/C/E/F) —
    // this is a shape mismatch on a real object (wrong nesting), not a wrong root type.
    expect(parsed.errors.some((e: string) => !e.match(/expected object.*received string/i))).toBe(true);
  });

  it('case E: null — rejected with a specific error', async () => {
    const repo = mockRepository();
    const handler = createEmitEventHandler(repo);
    const result = await handler({ envelope: null });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(false);
    expect(repo.write).not.toHaveBeenCalled();
    expect(parsed.errors[0]).not.toBe('(root): must be object');
  });

  it('case F: array-wrapped — rejected with a specific error', async () => {
    const repo = mockRepository();
    const handler = createEmitEventHandler(repo);
    const result = await handler({ envelope: [VALID_EVENT] as unknown });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(false);
    expect(repo.write).not.toHaveBeenCalled();
    expect(parsed.errors[0]).not.toBe('(root): must be object');
  });
});

// ── req-012: old `{ event: ... }` top-level argument shape no longer valid ────

describe('req-012 — old { event: ... } tool argument shape is rejected', () => {
  it('rejects the pre-0.10.0 { event: envelope } call shape (envelope is now required)', async () => {
    const repo = mockRepository();
    const handler = createEmitEventHandler(repo);
    // Simulates a caller still using the old argument name — envelope is absent.
    const result = await handler({ event: VALID_EVENT } as unknown as { envelope: unknown });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(false);
    expect(repo.write).not.toHaveBeenCalled();
  });
});
