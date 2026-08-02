import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import {
  CREATE_EVENTS_TABLE,
  MIGRATE_ADD_MODEL_CONFIG,
  MIGRATE_ADD_PRODUCT_ID,
  CREATE_SESSION_INDEX,
  CREATE_EVENT_TIMESTAMP_INDEX,
  CREATE_PHASE_SESSION_INDEX,
} from './schema.js';

export type { DuckDBConnection };

export interface DbHandle {
  connect(): Promise<DuckDBConnection>;
  closeSync(): void;
}

let instance: DuckDBInstance | null = null;
let dbPath: string | null = null;

/** Resolves the DuckDB file path from env or default. */
export function resolveDbPath(): string {
  return process.env['PLANIFEST_TELEMETRY_DB'] ?? join(homedir(), '.planifest', 'telemetry.db');
}

/** Opens (or returns the existing) DuckDB instance and ensures schema is initialised. */
export async function openDatabase(path?: string): Promise<DuckDBInstance> {
  const resolvedPath = path ?? resolveDbPath();

  if (instance !== null && dbPath === resolvedPath) {
    return instance;
  }

  // Ensure parent directory exists.
  mkdirSync(dirname(resolvedPath), { recursive: true });

  const db = await DuckDBInstance.create(resolvedPath);
  const conn = await db.connect();

  try {
    await conn.run(CREATE_EVENTS_TABLE);
    await conn.run(MIGRATE_ADD_MODEL_CONFIG);
    await conn.run(MIGRATE_ADD_PRODUCT_ID);
    await conn.run(CREATE_SESSION_INDEX);
    await conn.run(CREATE_EVENT_TIMESTAMP_INDEX);
    await conn.run(CREATE_PHASE_SESSION_INDEX);
  } finally {
    conn.disconnectSync();
  }

  instance = db;
  dbPath = resolvedPath;
  return db;
}

/** Closes the current DuckDB instance. */
export function closeDatabase(): void {
  if (instance !== null) {
    instance.closeSync();
    instance = null;
    dbPath = null;
  }
}
