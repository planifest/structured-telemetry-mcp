/**
 * req-006/req-007: the backup sidecar metadata file — a small JSON file
 * recording the outcome of the most recent *verified* backup (timestamp,
 * rowCount, artifactPath; data-contract.md's Backup Artifacts section).
 *
 * Deliberately zero-dependency on @duckdb/node-api: req-007's `doctor` check
 * must be able to report backup staleness without ever opening telemetry.db
 * (confirmed risk — src/cli.ts's existing runDoctor() already opens a second,
 * independent connection for its write-test check, which can itself fail or
 * block under DuckDB's single-writer lock while the daemon is running). This
 * module is imported directly by src/cli.ts for that reason; the DuckDB-
 * dependent export/import logic lives in ./backup-service.ts instead, which
 * imports the constants from here — never the other way around.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const SIDECAR_FILENAME = 'latest-verified-backup.json';

export interface BackupMetadata {
  /** ISO 8601 timestamp — when the verified export completed. */
  timestamp: string;
  /** Row count pinned at export time and confirmed by scratch-restore verification. */
  rowCount: number;
  /** Path to the promoted backup directory. */
  artifactPath: string;
}

/**
 * Resolves the backup directory: PLANIFEST_TELEMETRY_BACKUP_DIR, defaulting
 * to ~/.planifest-backups — a sibling of, not nested inside, ~/.planifest/
 * (ADR-029), independent of any PLANIFEST_TELEMETRY_DB override.
 */
export function resolveBackupDir(): string {
  return process.env['PLANIFEST_TELEMETRY_BACKUP_DIR'] ?? join(homedir(), '.planifest-backups');
}

export function sidecarPath(backupDir: string = resolveBackupDir()): string {
  return join(backupDir, SIDECAR_FILENAME);
}

export type ReadBackupMetadataResult =
  | { state: 'verified'; metadata: BackupMetadata }
  | { state: 'absent' }
  | { state: 'malformed'; detail: string };

function isBackupMetadata(value: unknown): value is BackupMetadata {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['timestamp'] === 'string' &&
    typeof v['rowCount'] === 'number' &&
    Number.isFinite(v['rowCount']) &&
    typeof v['artifactPath'] === 'string'
  );
}

/**
 * Reads and validates the sidecar metadata file. Never throws — distinguishes
 * "no verified backup" (file absent — normal, not an error) from "malformed
 * or unreadable" (a distinct warning state), per req-007.
 */
export function readBackupMetadata(backupDir: string = resolveBackupDir()): ReadBackupMetadataResult {
  const path = sidecarPath(backupDir);

  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') return { state: 'absent' };
    return { state: 'malformed', detail: `unreadable: ${err}` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { state: 'malformed', detail: `invalid JSON: ${err}` };
  }

  if (!isBackupMetadata(parsed)) {
    return { state: 'malformed', detail: 'missing or invalid required fields (timestamp, rowCount, artifactPath)' };
  }

  return { state: 'verified', metadata: parsed };
}
