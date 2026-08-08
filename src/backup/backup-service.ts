/**
 * req-006: scheduled, verified backup. ADR-028: EXPORT DATABASE (Parquet)
 * rather than a raw file copy. ADR-029: triggered by an in-process timer
 * (src/server-http.ts), using the daemon's own already-open DuckDB
 * connection — never a second connection to telemetry.db.
 *
 * Sequence, strictly ordered per req-006 (mirrors src/db/checkpoint.ts's
 * degrade-and-keep-serving style — never throws, always warns on failure):
 *   1. Pin the row count at the moment export *begins* (not after, since the
 *      live table may keep growing during export).
 *   2. EXPORT DATABASE to a `.tmp-`-prefixed directory, on the daemon's own
 *      connection.
 *   3. Restore into a scratch, in-memory DuckDB instance (IMPORT DATABASE) —
 *      a fresh, separate instance, so this step never touches telemetry.db
 *      and cannot contend with the daemon's connection.
 *   4. Assert the scratch-restored row count matches the pinned count.
 *   5. Only on success: promote (rename) the temp export into the retained
 *      set, then write the sidecar metadata file, then prune.
 * Any failure at any step warns and leaves the previously-promoted set
 * completely untouched — never a partial promotion, never a partial prune.
 */
import { DuckDBInstance } from '@duckdb/node-api';
import type { DuckDBConnection } from '@duckdb/node-api';
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveBackupDir, sidecarPath, type BackupMetadata } from './backup-metadata.js';

export type { BackupMetadata };
export { resolveBackupDir };

export type Warn = (message: string) => void;

export const RETAIN_DAILY = 7;
export const RETAIN_WEEKLY = 4;

type Connectable = Pick<DuckDBInstance, 'connect'>;
type ScratchInstance = { connect: DuckDBInstance['connect']; closeSync: DuckDBInstance['closeSync'] };

export interface RunBackupOptions {
  /** Overridable for tests; defaults to resolveBackupDir() (PLANIFEST_TELEMETRY_BACKUP_DIR). */
  backupDir?: string;
  /** Overridable clock for deterministic tests. */
  now?: () => Date;
  /** Factory for the scratch-verification instance. Defaults to a real, fresh, in-memory DuckDBInstance — never touches telemetry.db. */
  createScratchInstance?: () => Promise<ScratchInstance>;
}

async function countEvents(conn: Pick<DuckDBConnection, 'runAndReadAll'>): Promise<number> {
  const result = await conn.runAndReadAll('SELECT COUNT(*) FROM events');
  const rows = result.getRows() as Array<[unknown]>;
  return Number(rows[0]?.[0] ?? 0);
}

function stampFor(date: Date): string {
  // Filesystem-safe, lexicographically-sortable (chronological) stamp.
  return date.toISOString().replace(/[:.]/g, '-');
}

/**
 * Escapes a path for interpolation into a single-quoted DuckDB SQL string
 * literal (standard SQL literal escaping: double each embedded single quote).
 * `tmpPath`/`finalPath` are built from PLANIFEST_TELEMETRY_BACKUP_DIR (an
 * operator-controlled env var, not attacker-reachable over the network) plus
 * a regex-constrained timestamp — but an unescaped embedded quote would still
 * break or corrupt the EXPORT/IMPORT DATABASE statement (P5 security finding,
 * CWE-88-adjacent; DuckDB has no parameterized-path binding for these
 * statements, mirroring the identifier-injection class ADR-024 addresses
 * for SQL column identifiers elsewhere in this codebase).
 */
export function sqlPathLiteral(path: string): string {
  return path.replace(/'/g, "''");
}

function removeQuietly(path: string): void {
  try {
    rmSync(path, { recursive: true, force: true });
  } catch {
    /* best-effort cleanup only */
  }
}

/**
 * Runs one full backup cycle. Never throws. Returns true only if the backup
 * was verified and promoted; false on any failure (already warned).
 */
export async function runBackup(db: Connectable, warn: Warn, opts: RunBackupOptions = {}): Promise<boolean> {
  const backupDir = opts.backupDir ?? resolveBackupDir();
  const now = opts.now ?? ((): Date => new Date());
  const createScratch = opts.createScratchInstance ?? ((): Promise<ScratchInstance> => DuckDBInstance.create());

  const nowDate = now();
  const timestamp = nowDate.toISOString();
  const stamp = stampFor(nowDate);
  const tmpPath = join(backupDir, `.tmp-${stamp}`);
  const finalPath = join(backupDir, stamp);

  try {
    mkdirSync(backupDir, { recursive: true });

    // Step 1 + 2: pin the row count, then EXPORT DATABASE, on the daemon's
    // own connection (ADR-029) — never a second connection to telemetry.db.
    const conn = await db.connect();
    let pinnedRowCount: number;
    try {
      pinnedRowCount = await countEvents(conn);
      await conn.run(`EXPORT DATABASE '${sqlPathLiteral(tmpPath)}' (FORMAT PARQUET)`);
    } finally {
      conn.disconnectSync();
    }

    // Step 3 + 4: restore into a fresh, separate scratch instance and verify.
    const scratchDb = await createScratch();
    let verifiedRowCount: number;
    try {
      const scratchConn = await scratchDb.connect();
      try {
        await scratchConn.run(`IMPORT DATABASE '${sqlPathLiteral(tmpPath)}'`);
        verifiedRowCount = await countEvents(scratchConn);
      } finally {
        scratchConn.disconnectSync();
      }
    } finally {
      scratchDb.closeSync();
    }

    if (verifiedRowCount !== pinnedRowCount) {
      warn(
        `backup warning: scratch-restore row count (${verifiedRowCount}) did not match the count pinned at export ` +
          `start (${pinnedRowCount}) — not promoting ${tmpPath}`,
      );
      removeQuietly(tmpPath);
      return false;
    }

    // Step 5: promote, then write the sidecar, then prune — strictly in this
    // order, so a crash between any two steps never leaves a promoted
    // artifact with no sidecar pointing at *an* earlier good state, and
    // pruning only ever runs once promotion is already durable.
    renameSync(tmpPath, finalPath);

    const metadata: BackupMetadata = { timestamp, rowCount: verifiedRowCount, artifactPath: finalPath };
    writeFileSync(sidecarPath(backupDir), JSON.stringify(metadata, null, 2) + '\n');

    pruneRetainedSet(backupDir, stamp, warn, nowDate);

    return true;
  } catch (err) {
    warn(`backup warning: ${err}`);
    removeQuietly(tmpPath);
    return false;
  }
}

/** Reverses stampFor(). Returns null for names that aren't one of our own artifact stamps (never touched, by construction). */
function parseStamp(name: string): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/.exec(name);
  if (!m) return null;
  const [, datePart, hh, mm, ss, ms] = m;
  const date = new Date(`${datePart}T${hh}:${mm}:${ss}.${ms}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Prunes the retained backup set down to 7 daily + 4 weekly. The most recent
 * RETAIN_DAILY artifacts are always kept. Older artifacts are bucketed by
 * age into RETAIN_WEEKLY 7-day-wide weekly windows (ages
 * RETAIN_DAILY..RETAIN_DAILY+7*RETAIN_WEEKLY days); within each bucket the
 * single *oldest* artifact is kept as that week's representative — this
 * (rather than picking whichever entry happens to be newest in the bucket)
 * is what keeps a representative stable as it ages from one bucket into the
 * next on successive daily runs, instead of being displaced by that day's
 * freshly-evicted daily artifact every single day. Anything older than the
 * 4-week window is dropped entirely, with no replacement.
 *
 * Only ever touches directories that parse as one of our own artifact stamps
 * (`.tmp-`/scratch leftovers and anything foreign are never considered) and
 * never removes `justPromotedName`, the artifact just promoted in this same
 * run. Tolerates the set momentarily holding one extra entry — promote
 * always happens before prune, never the reverse.
 */
export function pruneRetainedSet(backupDir: string, justPromotedName: string, warn: Warn, now: Date = new Date()): void {
  let names: string[];
  try {
    names = readdirSync(backupDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name);
  } catch (err) {
    warn(`backup warning: prune could not list ${backupDir}: ${err}`);
    return;
  }

  const parsed = names
    .map((name) => ({ name, date: parseStamp(name) }))
    .filter((e): e is { name: string; date: Date } => e.date !== null)
    .sort((a, b) => b.date.getTime() - a.date.getTime()); // newest first

  const keep = new Set<string>();
  for (const e of parsed.slice(0, RETAIN_DAILY)) keep.add(e.name);

  const nowMs = now.getTime();
  const bucketRepresentative = new Map<number, { name: string; date: Date }>();
  for (const e of parsed.slice(RETAIN_DAILY)) {
    const ageDays = (nowMs - e.date.getTime()) / MS_PER_DAY;
    const bucketIndex = Math.floor((ageDays - RETAIN_DAILY) / 7);
    if (bucketIndex < 0 || bucketIndex >= RETAIN_WEEKLY) continue; // too young to be "older", or aged out entirely
    const existing = bucketRepresentative.get(bucketIndex);
    if (existing === undefined || e.date.getTime() < existing.date.getTime()) {
      bucketRepresentative.set(bucketIndex, e); // oldest-in-bucket wins
    }
  }
  for (const e of bucketRepresentative.values()) keep.add(e.name);

  // Defensive: never prune the artifact just promoted in this run.
  keep.add(justPromotedName);

  for (const e of parsed) {
    if (!keep.has(e.name)) {
      try {
        rmSync(join(backupDir, e.name), { recursive: true, force: true });
      } catch (err) {
        warn(`backup warning: failed to prune ${e.name}: ${err}`);
      }
    }
  }
}

