/**
 * req-006: scheduled, verified backup. Exercises runBackup directly (not via
 * HTTP) against a real DuckDB instance for the full export -> scratch-restore
 * verify -> promote -> sidecar -> prune sequence (ADR-028: EXPORT DATABASE;
 * ADR-029: the daemon's own connection, a fresh separate scratch instance),
 * plus db doubles to force the failure paths (verification mismatch,
 * mid-export interruption) deterministically, without needing to fabricate a
 * real DuckDB-level fault.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import type { DuckDBInstance } from '@duckdb/node-api';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runBackup } from '../../src/backup/backup-service.js';
import { readBackupMetadata } from '../../src/backup/backup-metadata.js';
import { openDatabase, closeDatabase } from '../../src/db/index.js';
import { DuckDbEventRepository } from '../../src/db/duckdb-event-repository.js';
import { buildEnvelope } from '../e2e/support/fixtures.js';

const activeDirs: string[] = [];

afterEach(() => {
  closeDatabase();
  for (const dir of activeDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function freshWorkDir(prefix: string): { workDir: string; dbPath: string; backupDir: string } {
  const workDir = mkdtempSync(join(tmpdir(), prefix));
  activeDirs.push(workDir);
  return { workDir, dbPath: join(workDir, 'telemetry.db'), backupDir: join(workDir, 'backups') };
}

async function seededDb(dbPath: string, rowCount: number): Promise<DuckDBInstance> {
  const db = await openDatabase(dbPath);
  const repo = new DuckDbEventRepository(db);
  for (let i = 0; i < rowCount; i++) {
    const result = await repo.write(buildEnvelope({ session_id: `backup-seed-${i}` }));
    if (!result.ok) throw new Error(`seed write ${i} failed`);
  }
  return db;
}

function listPromoted(backupDir: string): string[] {
  if (!existsSync(backupDir)) return [];
  return readdirSync(backupDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name);
}

describe('req-006: runBackup — happy path', () => {
  it('exports, verifies via scratch restore, promotes, and writes the sidecar with the pinned row count', async () => {
    const { dbPath, backupDir } = freshWorkDir('telemetry-backup-');
    const db = await seededDb(dbPath, 3);
    const warn = vi.fn();

    const ok = await runBackup(db, warn, { backupDir });

    expect(ok).toBe(true);
    expect(warn).not.toHaveBeenCalled();

    const meta = readBackupMetadata(backupDir);
    expect(meta.state).toBe('verified');
    if (meta.state === 'verified') {
      expect(meta.metadata.rowCount).toBe(3);
      expect(existsSync(meta.metadata.artifactPath)).toBe(true);
    }
    expect(listPromoted(backupDir)).toHaveLength(1);
  });

  it('a fresh install with zero rows verifies a row count of 0 correctly, not as a failure', async () => {
    const { dbPath, backupDir } = freshWorkDir('telemetry-backup-empty-');
    const db = await seededDb(dbPath, 0);
    const warn = vi.fn();

    const ok = await runBackup(db, warn, { backupDir });

    expect(ok).toBe(true);
    expect(warn).not.toHaveBeenCalled();
    const meta = readBackupMetadata(backupDir);
    expect(meta.state).toBe('verified');
    if (meta.state === 'verified') expect(meta.metadata.rowCount).toBe(0);
  });

  it('creates the backup directory without error on a fresh install (absence beforehand is normal)', async () => {
    const { dbPath, backupDir } = freshWorkDir('telemetry-backup-fresh-');
    expect(existsSync(backupDir)).toBe(false);
    const db = await seededDb(dbPath, 0);

    const ok = await runBackup(db, vi.fn(), { backupDir });

    expect(ok).toBe(true);
    expect(existsSync(backupDir)).toBe(true);
  });

  it('P5 security fix: a backup dir path containing a single quote (e.g. from an operator-set PLANIFEST_TELEMETRY_BACKUP_DIR) does not break EXPORT/IMPORT DATABASE', async () => {
    const { dbPath, workDir } = freshWorkDir('telemetry-backup-quote-');
    const backupDir = join(workDir, "o'brien's backups");
    const db = await seededDb(dbPath, 2);
    const warn = vi.fn();

    const ok = await runBackup(db, warn, { backupDir });

    expect(ok).toBe(true);
    expect(warn).not.toHaveBeenCalled();
    const meta = readBackupMetadata(backupDir);
    expect(meta.state).toBe('verified');
    if (meta.state === 'verified') expect(meta.metadata.rowCount).toBe(2);
  });
});

describe('req-006: runBackup — verification failure never promotes', () => {
  it('does not promote and does not write the sidecar when scratch-restore row count mismatches the pinned count', async () => {
    const { dbPath, backupDir } = freshWorkDir('telemetry-backup-mismatch-');
    const db = await seededDb(dbPath, 5);
    const warn = vi.fn();

    // A scratch instance stub that always reports a wrong row count, forcing
    // the verification assertion to fail regardless of the real export.
    const ok = await runBackup(db, warn, {
      backupDir,
      createScratchInstance: async () => ({
        connect: (async () => ({
          run: async () => undefined,
          runAndReadAll: async () => ({ getRows: () => [[999]] }),
          disconnectSync: () => undefined,
        })) as unknown as DuckDBInstance['connect'],
        closeSync: () => undefined,
      }),
    });

    expect(ok).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('row count');

    expect(readBackupMetadata(backupDir).state).toBe('absent');
    expect(listPromoted(backupDir)).toHaveLength(0);
  });
});

describe('req-006: runBackup — a failing run never disturbs the previously-promoted set', () => {
  it('leaves an already-promoted backup and its sidecar completely untouched when a later run fails mid-export', async () => {
    const { dbPath, backupDir } = freshWorkDir('telemetry-backup-interrupt-');
    const db = await seededDb(dbPath, 2);

    const goodOk = await runBackup(db, vi.fn(), { backupDir, now: () => new Date('2026-08-01T00:00:00.000Z') });
    expect(goodOk).toBe(true);

    const before = readBackupMetadata(backupDir);
    expect(before.state).toBe('verified');
    const beforeEntries = listPromoted(backupDir).sort();

    // A db double whose EXPORT call throws — simulates a mid-export failure
    // (e.g. the process being killed, disk full) without a real DuckDB fault.
    const failingDb = {
      connect: async () => ({
        runAndReadAll: async () => ({ getRows: () => [[2]] }),
        run: async (sql: string) => {
          if (sql.startsWith('EXPORT DATABASE')) throw new Error('simulated export interruption');
        },
        disconnectSync: () => undefined,
      }),
    } as unknown as Pick<DuckDBInstance, 'connect'>;

    const warn = vi.fn();
    const failOk = await runBackup(failingDb, warn, { backupDir, now: () => new Date('2026-08-02T00:00:00.000Z') });

    expect(failOk).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('simulated export interruption');

    const after = readBackupMetadata(backupDir);
    expect(after).toEqual(before);
    expect(listPromoted(backupDir).sort()).toEqual(beforeEntries);
  });
});

describe('req-006: pruning after promotion — through real sequential runBackup calls', () => {
  it('keeps the 7 most-recent daily artifacts plus one aged-in weekly representative after 9 daily runs', async () => {
    const { dbPath, backupDir } = freshWorkDir('telemetry-backup-prune-');
    const db = await seededDb(dbPath, 0);

    const dayStamp = (day: number): string =>
      new Date(Date.UTC(2026, 0, 1 + day)).toISOString().replace(/[:.]/g, '-');

    for (let day = 0; day <= 8; day++) {
      const ok = await runBackup(db, vi.fn(), { backupDir, now: () => new Date(Date.UTC(2026, 0, 1 + day)) });
      expect(ok).toBe(true);
    }

    const retained = listPromoted(backupDir).sort();
    // day 0 (age 8 at the final run, the first artifact ever to age past the
    // 7-daily window) survives as the first weekly representative; day 1
    // gets squeezed out — never promoted twice into the same weekly slot.
    const expectedKept = [0, 2, 3, 4, 5, 6, 7, 8].map(dayStamp).sort();
    expect(retained).toEqual(expectedKept);
  });
});
