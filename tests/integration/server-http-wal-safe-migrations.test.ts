/**
 * req-003: WAL-safe schema migrations. After src/db/index.ts's openDatabase()
 * runs the pending ALTER TABLE ADD COLUMN migrations, it must checkpoint
 * immediately — before src/server-http.ts opens its HTTP listener — so an
 * unclean kill immediately after startup never needs to replay an ALTER from
 * the WAL (the 2026-08-03 incident's root cause).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { DuckDBInstance } from '@duckdb/node-api';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startLiveServer, type LiveServer } from './support/server-lifecycle-harness.js';

const activeDirs: string[] = [];
const activeServers: LiveServer[] = [];

/** Retries DuckDBInstance.create briefly — the OS can take a beat to release the advisory lock after SIGKILL. */
async function openWithRetry(dbPath: string, attempts = 10, delayMs = 200): Promise<DuckDBInstance> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await DuckDBInstance.create(dbPath);
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

afterEach(async () => {
  for (const server of activeServers.splice(0)) {
    try { server.killGroup(); } catch { /* already exited */ }
  }
  for (const dir of activeDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('req-003: WAL-safe migrations', () => {
  it('checkpoints the fresh-database migrations before the HTTP listener opens (no WAL left pending)', async () => {
    const dbDir = mkdtempSync(join(tmpdir(), 'telemetry-wal-safe-'));
    activeDirs.push(dbDir);
    const dbPath = join(dbDir, 'telemetry.db');

    const server = await startLiveServer({ dbPath });
    activeServers.push(server);

    // The migration + checkpoint happen inside openDatabase(), which is fully
    // awaited before server.listen() runs — so by the time we observe "ready",
    // the ALTERs must already be flushed out of the WAL.
    expect(existsSync(`${dbPath}.wal`)).toBe(false);
  });

  it('survives an unclean kill immediately after startup with no unreplayable WAL', async () => {
    const dbDir = mkdtempSync(join(tmpdir(), 'telemetry-wal-safe-kill-'));
    activeDirs.push(dbDir);
    const dbPath = join(dbDir, 'telemetry.db');

    const server = await startLiveServer({ dbPath });
    activeServers.push(server);
    server.killGroup();
    await server.waitForExit();

    // Reopening must succeed without hitting the ReplayAlter WAL-replay failure.
    // (The OS can take a beat to release the advisory lock after SIGKILL —
    // retry briefly rather than racing it; this is unrelated to req-003 itself.)
    const db = await openWithRetry(dbPath);
    const conn = await db.connect();
    const result = await conn.runAndReadAll('SELECT count(*) FROM events');
    expect(result.getRows().length).toBe(1);
    conn.disconnectSync();
    db.closeSync();
  });

  it('starts normally against an already-migrated database (ADD COLUMN IF NOT EXISTS no-op)', async () => {
    const dbDir = mkdtempSync(join(tmpdir(), 'telemetry-wal-safe-remigrate-'));
    activeDirs.push(dbDir);
    const dbPath = join(dbDir, 'telemetry.db');

    const first = await startLiveServer({ dbPath });
    await first.stop('SIGTERM');

    const second = await startLiveServer({ dbPath });
    activeServers.push(second);
    expect(existsSync(`${dbPath}.wal`)).toBe(false);
  });
});
