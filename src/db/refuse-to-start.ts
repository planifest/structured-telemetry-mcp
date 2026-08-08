/**
 * req-004: classification and diagnostic formatting for the daemon's
 * refuse-to-start path (an unopenable database at startup).
 *
 * See plan/current/requirements/req-004-refuse-to-start-unopenable-database.md
 * and ADR-030 (refuse-to-start exits zero, deliberately, per launchd/systemd's
 * SuccessfulExit/Restart=on-failure semantics).
 */

export type StartupFailureKind = 'lock-held' | 'poisoned-wal';

export interface ClassifiedStartupError {
  kind: StartupFailureKind;
  /** Best-effort — DuckDB's lock error does not always expose the holder's PID. */
  conflictingPid?: string;
}

// Confirmed against this DuckDB version's actual error text (@duckdb/node-api 1.5.1-r.2):
//   "IO Error: Could not set lock on file \"<path>\": Conflicting lock is held in
//    <exe> (PID <n>) by user <user>. See also https://duckdb.org/docs/stable/connect/concurrency"
const LOCK_HELD_RE = /Could not set lock on file/i;
const PID_RE = /\(PID (\d+)\)/;

// Confirmed against the 2026-08-03 incident's captured error text
// (plan/current/backlog-pickup/00008-daemon-durability-unreplayable-wal/entry.md):
//   "INTERNAL Error: Failure while replaying WAL file \"<path>\": Calling
//    DatabaseManager::GetDefaultDatabase with no default database set"
const POISONED_WAL_RE = /Failure while replaying WAL file/i;

/**
 * Distinguishes "the store is unusable" (refuse-to-start: lock contention or an
 * unreplayable/poisoned WAL) from any other startup error (missing config, an
 * unrelated exception). Returns null for the latter — those keep their existing
 * (crash) behaviour rather than triggering refuse-to-start.
 */
export function classifyStartupError(err: unknown): ClassifiedStartupError | null {
  const message = err instanceof Error ? err.message : String(err);

  if (LOCK_HELD_RE.test(message)) {
    const pidMatch = PID_RE.exec(message);
    return { kind: 'lock-held', conflictingPid: pidMatch?.[1] };
  }

  if (POISONED_WAL_RE.test(message)) {
    return { kind: 'poisoned-wal' };
  }

  return null;
}

/** Documented operator restore procedure (ADR-028 / req-006). */
export const RESTORE_PROCEDURE_PATH = 'src/structured-telemetry-mcp/docs/restore-procedure.md';

/**
 * Builds the single diagnostic message printed to stderr on refuse-to-start.
 * The first line must state plainly that deleting the WAL is irreversible
 * (risk-register.md R-003 — the exact mistake made on 2026-08-03).
 */
export function formatRefuseToStartMessage(dbPath: string, classification: ClassifiedStartupError): string {
  const walPath = `${dbPath}.wal`;
  const lines: string[] = [
    `Deleting ${walPath} is IRREVERSIBLE and will destroy any events not yet checkpointed into the main database file — do not delete it.`,
    '',
    '[telemetry-backend] refuse-to-start: the database is unusable — the daemon will not start serving.',
    `  Database file: ${dbPath}`,
  ];

  if (classification.kind === 'lock-held') {
    lines.push(
      classification.conflictingPid
        ? `  Reason: locked by another running process (conflicting PID: ${classification.conflictingPid}).`
        : '  Reason: locked by another running process (conflicting PID could not be determined from the DuckDB error).',
    );
  } else {
    lines.push('  Reason: poisoned WAL — the write-ahead log contains an entry DuckDB cannot replay.');
  }

  lines.push(`  Restore procedure: ${RESTORE_PROCEDURE_PATH}`);
  return lines.join('\n');
}
