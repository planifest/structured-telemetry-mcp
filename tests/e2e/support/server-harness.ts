/**
 * E2E test harness (req-001, req-002, ADR-022): starts a real server-http.ts
 * child process against a fresh temp-file DuckDB, on an OS-assigned ephemeral
 * port (never hardcoded — R-002), bound to 127.0.0.1 only (R-005). Torn down
 * after each caller's use. One instance per test file (per-file isolation).
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const TSX_BIN = join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

const READY_RE = /ready — http:\/\/127\.0\.0\.1:(\d+)/;
const READY_TIMEOUT_MS = 15_000;

export interface ServerHandle {
  readonly baseURL: string;
  stop(): Promise<void>;
}

export async function startServer(extraEnv: Record<string, string> = {}): Promise<ServerHandle> {
  const dbDir = mkdtempSync(join(tmpdir(), 'telemetry-e2e-'));
  const dbPath = join(dbDir, 'telemetry.db');

  const child: ChildProcess = spawn(TSX_BIN, ['src/server-http.ts'], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PLANIFEST_MCP_PORT: '0',
      PLANIFEST_TELEMETRY_DB: dbPath,
      // Optional per-test overrides (e.g. a small PLANIFEST_MAX_BODY_BYTES so a
      // body-cap test need not stream 4 MB). Non-breaking: default is no override.
      ...extraEnv,
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  const port = await new Promise<number>((resolvePort, reject) => {
    let buf = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`server-http.ts did not report ready within ${READY_TIMEOUT_MS}ms\n${buf}`));
    }, READY_TIMEOUT_MS);

    const onData = (chunk: Buffer): void => {
      buf += chunk.toString('utf8');
      const match = READY_RE.exec(buf);
      if (match && !settled) {
        settled = true;
        clearTimeout(timer);
        cleanup();
        resolvePort(Number(match[1]));
      }
    };
    const onExit = (code: number | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      reject(new Error(`server-http.ts exited early (code ${code})\n${buf}`));
    };
    const onError = (err: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      reject(err);
    };

    function cleanup(): void {
      child.stderr?.off('data', onData);
      child.off('exit', onExit);
      child.off('error', onError);
    }

    child.stderr?.on('data', onData);
    child.on('exit', onExit);
    child.on('error', onError);
  });

  return {
    baseURL: `http://127.0.0.1:${port}`,
    async stop(): Promise<void> {
      await new Promise<void>((resolveStop) => {
        child.once('exit', () => resolveStop());
        child.kill();
      });
      rmSync(dbDir, { recursive: true, force: true });
    },
  };
}
