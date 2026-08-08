/**
 * req-004 test fixture: opens the given DuckDB path and holds it open
 * indefinitely, printing a ready marker + its own PID, so a sibling process
 * can attempt to open the same path and observe the resulting lock-contention
 * error (and confirm the conflicting PID is nameable).
 *
 * Usage: tsx tests/integration/support/hold-db-lock.ts <dbPath>
 * Terminate with SIGTERM/SIGKILL from the caller when done.
 */
import { DuckDBInstance } from '@duckdb/node-api';

const dbPath = process.argv[2];
if (!dbPath) {
  process.stderr.write('usage: hold-db-lock.ts <dbPath>\n');
  process.exit(1);
}

const db = await DuckDBInstance.create(dbPath);
const conn = await db.connect();
await conn.run('CREATE TABLE IF NOT EXISTS events (id VARCHAR)');

process.stdout.write(`LOCK_HELD pid=${process.pid}\n`);

// Keep the process (and the lock) alive until killed by the caller.
setInterval(() => { /* hold */ }, 60_000);
