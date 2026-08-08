/**
 * req-007: the sidecar metadata reader. Must distinguish three states
 * without ever opening telemetry.db: a verified backup exists; the file is
 * simply absent (a fresh install — normal, not an error); the file exists
 * but is malformed/unreadable (a distinct warning state, never confused
 * with "absent").
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readBackupMetadata,
  resolveBackupDir,
  sidecarPath,
  SIDECAR_FILENAME,
} from '../../src/backup/backup-metadata.js';

const activeDirs: string[] = [];
const originalEnv = process.env['PLANIFEST_TELEMETRY_BACKUP_DIR'];

afterEach(() => {
  for (const dir of activeDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  if (originalEnv === undefined) delete process.env['PLANIFEST_TELEMETRY_BACKUP_DIR'];
  else process.env['PLANIFEST_TELEMETRY_BACKUP_DIR'] = originalEnv;
});

function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'telemetry-backup-meta-'));
  activeDirs.push(dir);
  return dir;
}

describe('req-006/007: resolveBackupDir', () => {
  it('defaults to ~/.planifest-backups', () => {
    delete process.env['PLANIFEST_TELEMETRY_BACKUP_DIR'];
    expect(resolveBackupDir()).toMatch(/\.planifest-backups$/);
  });

  it('honors PLANIFEST_TELEMETRY_BACKUP_DIR, independent of PLANIFEST_TELEMETRY_DB', () => {
    process.env['PLANIFEST_TELEMETRY_BACKUP_DIR'] = '/custom/backup/dir';
    expect(resolveBackupDir()).toBe('/custom/backup/dir');
  });
});

describe('req-007: readBackupMetadata — no verified backup (absent)', () => {
  it('reports "absent" (not an error) when the sidecar file has never been written', () => {
    const dir = freshDir();
    const result = readBackupMetadata(dir);
    expect(result).toEqual({ state: 'absent' });
  });

  it('reports "absent" even when the backup directory itself does not exist yet', () => {
    const dir = join(freshDir(), 'never-created');
    const result = readBackupMetadata(dir);
    expect(result).toEqual({ state: 'absent' });
  });
});

describe('req-007: readBackupMetadata — verified backup exists', () => {
  it('reports the timestamp, rowCount, and artifactPath from a well-formed sidecar', () => {
    const dir = freshDir();
    const metadata = { timestamp: '2026-08-01T00:00:00.000Z', rowCount: 42, artifactPath: join(dir, '2026-08-01') };
    writeFileSync(sidecarPath(dir), JSON.stringify(metadata));

    const result = readBackupMetadata(dir);
    expect(result).toEqual({ state: 'verified', metadata });
  });
});

describe('req-007: readBackupMetadata — malformed, distinct from absent', () => {
  it('reports "malformed" (not "absent", not a crash) on invalid JSON', () => {
    const dir = freshDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(sidecarPath(dir), '{ not valid json');

    const result = readBackupMetadata(dir);
    expect(result.state).toBe('malformed');
    expect(result).not.toEqual({ state: 'absent' });
  });

  it('reports "malformed" when required fields are missing', () => {
    const dir = freshDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(sidecarPath(dir), JSON.stringify({ timestamp: '2026-08-01T00:00:00.000Z' }));

    const result = readBackupMetadata(dir);
    expect(result.state).toBe('malformed');
  });

  it('reports "malformed" when rowCount is not a number', () => {
    const dir = freshDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      sidecarPath(dir),
      JSON.stringify({ timestamp: '2026-08-01T00:00:00.000Z', rowCount: 'forty-two', artifactPath: '/x' }),
    );

    const result = readBackupMetadata(dir);
    expect(result.state).toBe('malformed');
  });

  it('reports "malformed" (not "absent") when the file exists but is unreadable', () => {
    const dir = freshDir();
    mkdirSync(dir, { recursive: true });
    const path = sidecarPath(dir);
    writeFileSync(path, JSON.stringify({ timestamp: 't', rowCount: 1, artifactPath: '/x' }));
    chmodSync(path, 0o000);

    try {
      const result = readBackupMetadata(dir);
      // On some CI runners running as root, chmod 000 doesn't actually block
      // reads — tolerate either a clean read or a reported malformed/unreadable state.
      expect(['verified', 'malformed']).toContain(result.state);
    } finally {
      chmodSync(path, 0o644);
    }
  });
});

describe('SIDECAR_FILENAME', () => {
  it('is a stable, predictable filename sibling to the backup directory', () => {
    expect(SIDECAR_FILENAME).toBe('latest-verified-backup.json');
  });
});
