/**
 * req-002: checkpoint execution with degrade-and-keep-serving failure handling.
 * Extracted from src/server-http.ts so the failure path — a checkpoint that
 * throws (transient lock contention, full disk, ...) must log a warning and
 * never crash the daemon or stop writes (domain-glossary.md:
 * degrade-and-keep-serving) — is unit-testable without forcing a real
 * disk-level failure.
 */
import type { DuckDBInstance } from '@duckdb/node-api';

export type Warn = (message: string) => void;

/**
 * Runs a single CHECKPOINT on a fresh connection. Never throws — on failure,
 * reports via `warn` and returns false so the caller knows not to reset its
 * write counter (req-002: "the next scheduled attempt will retry"). Returns
 * true on success.
 */
export async function runCheckpoint(db: Pick<DuckDBInstance, 'connect'>, warn: Warn): Promise<boolean> {
  try {
    const conn = await db.connect();
    try {
      await conn.run('CHECKPOINT');
    } finally {
      conn.disconnectSync();
    }
    return true;
  } catch (err) {
    warn(`checkpoint warning: ${err}`);
    return false;
  }
}
