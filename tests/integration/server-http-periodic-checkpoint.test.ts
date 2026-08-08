/**
 * req-002: periodic checkpoint. src/server-http.ts must checkpoint whenever
 * either 60s have elapsed since the last checkpoint or 100 writes have
 * happened since the last checkpoint, whichever comes first. The interval and
 * write threshold are overridable via env vars (PLANIFEST_CHECKPOINT_*) so
 * this can be verified by real execution — a live timer, a live HTTP server —
 * without either waiting a literal 60 real seconds or writing 100 real events
 * to prove the timer path.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startLiveServer, type LiveServer } from './support/server-lifecycle-harness.js';
import { buildEnvelope } from '../e2e/support/fixtures.js';

const activeDirs: string[] = [];
const activeServers: LiveServer[] = [];

afterEach(async () => {
  for (const server of activeServers.splice(0)) {
    try { server.killGroup(); } catch { /* already exited */ }
  }
  for (const dir of activeDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

async function waitUntil(predicate: () => boolean, timeoutMs: number, stepMs = 50): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  if (!predicate()) throw new Error(`condition not met within ${timeoutMs}ms`);
}

describe('req-002: periodic checkpoint — write-count trigger', () => {
  it('checkpoints once the write threshold is reached, well before the (effectively disabled) timer', async () => {
    const dbDir = mkdtempSync(join(tmpdir(), 'telemetry-checkpoint-count-'));
    activeDirs.push(dbDir);
    const dbPath = join(dbDir, 'telemetry.db');
    const walPath = `${dbPath}.wal`;

    const server = await startLiveServer({
      dbPath,
      env: {
        PLANIFEST_CHECKPOINT_INTERVAL_MS: String(3_600_000), // effectively disabled for this test
        PLANIFEST_CHECKPOINT_WRITE_THRESHOLD: '10',
      },
    });
    activeServers.push(server);

    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${server.baseURL}/emit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildEnvelope({ session_id: `req-002-count-${i}` })),
      });
      expect(res.status).toBe(200);
    }

    // The 10th write should have fired an (async, non-blocking) checkpoint.
    await waitUntil(() => !existsSync(walPath), 5_000);

    // Daemon keeps serving after the checkpoint.
    const health = await fetch(`${server.baseURL}/health`);
    expect(health.status).toBe(200);
  });
});

describe('req-002: periodic checkpoint — timer trigger', () => {
  it('checkpoints on the timer even under light write load (write threshold effectively disabled)', async () => {
    const dbDir = mkdtempSync(join(tmpdir(), 'telemetry-checkpoint-timer-'));
    activeDirs.push(dbDir);
    const dbPath = join(dbDir, 'telemetry.db');
    const walPath = `${dbPath}.wal`;

    const server = await startLiveServer({
      dbPath,
      env: {
        PLANIFEST_CHECKPOINT_INTERVAL_MS: '300',
        PLANIFEST_CHECKPOINT_WRITE_THRESHOLD: String(1_000_000), // effectively disabled
      },
    });
    activeServers.push(server);

    const res = await fetch(`${server.baseURL}/emit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildEnvelope({ session_id: 'req-002-timer' })),
    });
    expect(res.status).toBe(200);
    expect(existsSync(walPath)).toBe(true); // one write, well under threshold — WAL still pending

    await waitUntil(() => !existsSync(walPath), 5_000);
  });
});
