/**
 * req-006: the daily backup timer wired into src/server-http.ts, alongside
 * req-002's periodic-checkpoint timer (ADR-029: same in-process-timer
 * pattern, the daemon's own connection). PLANIFEST_BACKUP_INTERVAL_MS is
 * overridable so this is verifiable by real execution — a live timer, a live
 * HTTP server, a real EXPORT/IMPORT DATABASE cycle — without waiting a
 * literal 24 real hours.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startLiveServer, type LiveServer } from './support/server-lifecycle-harness.js';
import { buildEnvelope } from '../e2e/support/fixtures.js';
import { readBackupMetadata, sidecarPath } from '../../src/backup/backup-metadata.js';

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

describe('req-006: scheduled backup timer', () => {
  it('writes a verified sidecar metadata file reflecting the emitted events, without interrupting ingestion', async () => {
    const dbDir = mkdtempSync(join(tmpdir(), 'telemetry-backup-timer-db-'));
    activeDirs.push(dbDir);
    const dbPath = join(dbDir, 'telemetry.db');

    const backupDir = mkdtempSync(join(tmpdir(), 'telemetry-backup-timer-out-'));
    activeDirs.push(backupDir);

    const server = await startLiveServer({
      dbPath,
      env: {
        PLANIFEST_BACKUP_INTERVAL_MS: '300',
        PLANIFEST_TELEMETRY_BACKUP_DIR: backupDir,
        // Keep the checkpoint timer from interfering with this test's timing budget.
        PLANIFEST_CHECKPOINT_INTERVAL_MS: String(3_600_000),
        PLANIFEST_CHECKPOINT_WRITE_THRESHOLD: String(1_000_000),
      },
    });
    activeServers.push(server);

    for (let i = 0; i < 2; i++) {
      const res = await fetch(`${server.baseURL}/emit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildEnvelope({ session_id: `req-006-timer-${i}` })),
      });
      expect(res.status).toBe(200);
    }

    await waitUntil(() => existsSync(sidecarPath(backupDir)), 10_000);

    const meta = readBackupMetadata(backupDir);
    expect(meta.state).toBe('verified');
    if (meta.state === 'verified') {
      expect(meta.metadata.rowCount).toBeGreaterThanOrEqual(2);
      expect(existsSync(meta.metadata.artifactPath)).toBe(true);
    }

    // The daemon keeps serving after a backup cycle (backups never block ingestion).
    const health = await fetch(`${server.baseURL}/health`);
    expect(health.status).toBe(200);
  });
});
