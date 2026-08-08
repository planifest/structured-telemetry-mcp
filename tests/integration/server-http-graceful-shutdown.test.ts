/**
 * req-001: graceful shutdown checkpoint. SIGTERM/SIGINT must: stop accepting
 * new connections (server.close()), run a final CHECKPOINT, close the DB
 * connection, then exit 0 — bounded by a shutdown timeout so a hung
 * checkpoint can't hang the process forever (shared with req-002's timer via
 * PLANIFEST_SHUTDOWN_TIMEOUT_MS).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { DuckDBInstance } from '@duckdb/node-api';
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

async function writeOneEvent(baseURL: string, sessionId: string): Promise<void> {
  const res = await fetch(`${baseURL}/emit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(buildEnvelope({ session_id: sessionId })),
  });
  expect(res.status).toBe(200);
}

describe.each([['SIGTERM'], ['SIGINT']] as const)('req-001: graceful shutdown on %s', (signal) => {
  it(`flushes the WAL via a final checkpoint and exits 0 on ${signal}`, async () => {
    const dbDir = mkdtempSync(join(tmpdir(), `telemetry-shutdown-${signal}-`));
    activeDirs.push(dbDir);
    const dbPath = join(dbDir, 'telemetry.db');
    const walPath = `${dbPath}.wal`;

    const server = await startLiveServer({
      dbPath,
      env: { PLANIFEST_CHECKPOINT_INTERVAL_MS: String(3_600_000), PLANIFEST_CHECKPOINT_WRITE_THRESHOLD: '1000000' },
    });
    activeServers.push(server);

    await writeOneEvent(server.baseURL, `req-001-${signal}-write`);
    expect(existsSync(walPath)).toBe(true); // one write, well under threshold — nothing checkpointed yet

    const result = await server.stop(signal);

    expect(result.code).toBe(0);
    expect(existsSync(walPath)).toBe(false); // final checkpoint on shutdown flushed it

    // Reopening immediately after a graceful shutdown needs no WAL replay.
    const db = await DuckDBInstance.create(dbPath);
    const conn = await db.connect();
    const rows = await conn.runAndReadAll('SELECT count(*) FROM events');
    expect(rows.getRows().length).toBe(1);
    conn.disconnectSync();
    db.closeSync();
  });
});

describe('req-001: graceful shutdown — in-flight requests', () => {
  it('does not abruptly sever an in-flight request — server.close() lets it complete', async () => {
    const dbDir = mkdtempSync(join(tmpdir(), 'telemetry-shutdown-inflight-'));
    activeDirs.push(dbDir);
    const dbPath = join(dbDir, 'telemetry.db');

    const server = await startLiveServer({ dbPath });
    activeServers.push(server);

    const emitPromise = fetch(`${server.baseURL}/emit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildEnvelope({ session_id: 'req-001-inflight' })),
    });
    // Give the request a moment to actually reach the server (TCP handshake +
    // dispatch) before signalling shutdown — otherwise this races the socket
    // setup itself rather than testing "in-flight requests aren't severed".
    await new Promise((r) => setTimeout(r, 50));

    const [emitRes, stopResult] = await Promise.all([emitPromise, server.stop('SIGTERM')]);

    expect(emitRes.status).toBe(200);
    expect(stopResult.code).toBe(0);
  });
});
