/**
 * req-004 test fixture: reproduces the 2026-08-03 incident's poisoned-WAL state
 * on-disk at the given path, then exits abruptly (never checkpointing or closing
 * cleanly) so the stranded ALTER TABLE entry survives in the .wal file exactly as
 * an unclean `kill -9` would leave it. Run as a standalone process (via tsx) —
 * NOT imported into a long-lived process — because a clean DuckDB close/checkpoint
 * would erase the very condition this fixture exists to create.
 *
 * Usage: tsx tests/integration/support/make-poisoned-wal.ts <dbPath>
 */
import { DuckDBInstance } from '@duckdb/node-api';

const dbPath = process.argv[2];
if (!dbPath) {
  process.stderr.write('usage: make-poisoned-wal.ts <dbPath>\n');
  process.exit(1);
}

const db1 = await DuckDBInstance.create(dbPath);
const conn1 = await db1.connect();
await conn1.run(`
  CREATE TABLE IF NOT EXISTS events (
    id          VARCHAR     NOT NULL DEFAULT gen_random_uuid(),
    session_id  VARCHAR     NOT NULL,
    inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);
await conn1.run('CHECKPOINT');
conn1.disconnectSync();
db1.closeSync();

const db2 = await DuckDBInstance.create(dbPath);
const conn2 = await db2.connect();
for (let i = 0; i < 5; i++) {
  await conn2.run(`INSERT INTO events (session_id) VALUES ('seed-${i}')`);
}
// The ALTER's serialized default values (id/inserted_at) are what DuckDB's
// ReplayAlter cannot rebind on a fresh open — see backlog 00008's captured trace.
await conn2.run('ALTER TABLE events ADD COLUMN IF NOT EXISTS model_config JSON');

process.stdout.write('POISONED_WAL_READY\n');
// Deliberately do not disconnectSync()/closeSync() — that would checkpoint the
// WAL away. process.exit() simulates the unclean kill that leaves it stranded.
process.exit(0);
