/**
 * req-002: runCheckpoint's failure handling. Extracted from src/server-http.ts
 * so "a checkpoint that fails logs a warning and never crashes the daemon or
 * stops writes" (degrade-and-keep-serving, domain-glossary.md) is verifiable
 * deterministically, without needing to force a real disk-level failure.
 */
import { describe, it, expect, vi } from 'vitest';
import { runCheckpoint } from '../../src/db/checkpoint.js';

describe('req-002: runCheckpoint', () => {
  it('returns true and does not warn when CHECKPOINT succeeds', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const disconnectSync = vi.fn();
    const connect = vi.fn().mockResolvedValue({ run, disconnectSync });
    const warn = vi.fn();

    const ok = await runCheckpoint({ connect }, warn);

    expect(ok).toBe(true);
    expect(run).toHaveBeenCalledWith('CHECKPOINT');
    expect(disconnectSync).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns and resolves false, without throwing, when connect() rejects', async () => {
    const connect = vi.fn().mockRejectedValue(new Error('disk full'));
    const warn = vi.fn();

    await expect(runCheckpoint({ connect }, warn)).resolves.toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('disk full');
  });

  it('warns and resolves false, without throwing, when CHECKPOINT itself rejects, and still disconnects', async () => {
    const run = vi.fn().mockRejectedValue(new Error('lock contention'));
    const disconnectSync = vi.fn();
    const connect = vi.fn().mockResolvedValue({ run, disconnectSync });
    const warn = vi.fn();

    await expect(runCheckpoint({ connect }, warn)).resolves.toBe(false);
    expect(String(warn.mock.calls[0]?.[0])).toContain('lock contention');
    expect(disconnectSync).toHaveBeenCalledTimes(1);
  });
});
