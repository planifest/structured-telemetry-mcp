/**
 * Regression: enum validation
 *
 * All valid values for the phase and mcp_mode enums accepted.
 * Unknown values rejected.
 * Tests validateEvent() in isolation — no DB, no server.
 */

import { describe, it, expect } from 'vitest';
import { validateEvent } from '../../src/validation/validate-event.js';

const BASE = {
  schema_version: '1.0' as const,
  session_id: 'regression-session',
  agent: 'planifest-codegen-agent',
  tool: 'claude-code',
  model: 'claude-sonnet-4-6',
  timestamp: '2026-04-13T12:00:00Z',
};

// ── phase enum ────────────────────────────────────────────────────────────────

describe('phase enum — valid values accepted', () => {
  const phases = ['orchestrator', 'spec', 'adr', 'codegen', 'validate', 'security', 'docs', 'change', 'ship'];

  for (const phase of phases) {
    it(`accepts phase: "${phase}"`, () => {
      const result = validateEvent({ ...BASE, phase, mcp_mode: 'context', event: 'phase_start', data: { phase_name: phase } });
      expect(result.isValid).toBe(true);
    });
  }

  it('rejects an unknown phase', () => {
    const result = validateEvent({ ...BASE, phase: 'not_a_phase', mcp_mode: 'context', event: 'phase_start', data: { phase_name: 'x' } });
    expect(result.isValid).toBe(false);
  });
});

// ── mcp_mode enum ─────────────────────────────────────────────────────────────

describe('mcp_mode enum — valid values accepted', () => {
  const modes = ['none', 'workspace', 'context', 'workspace+context'];

  for (const mcp_mode of modes) {
    it(`accepts mcp_mode: "${mcp_mode}"`, () => {
      const result = validateEvent({ ...BASE, phase: 'codegen', mcp_mode, event: 'phase_start', data: { phase_name: 'codegen' } });
      expect(result.isValid).toBe(true);
    });
  }

  it('rejects an unknown mcp_mode', () => {
    const result = validateEvent({ ...BASE, phase: 'codegen', mcp_mode: 'turbo', event: 'phase_start', data: { phase_name: 'codegen' } });
    expect(result.isValid).toBe(false);
  });
});
