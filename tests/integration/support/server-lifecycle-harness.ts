/**
 * Shared test harness for req-001/req-002/req-003: spawns the real
 * src/server-http.ts as a child process (as an operator/launchd/systemd
 * would), on an OS-assigned ephemeral port, against a caller-supplied DuckDB
 * path. Distinct from tests/e2e/support/server-harness.ts (Playwright-only)
 * — this one is plain Node so vitest integration tests can use it too, and
 * exposes stop(signal) / captured stderr for lifecycle assertions that the
 * Playwright harness doesn't need.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const TSX_BIN = join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

const READY_RE = /ready — http:\/\/127\.0\.0\.1:(\d+)/;
const DEFAULT_TIMEOUT_MS = 15_000;

export interface LiveServer {
  readonly baseURL: string;
  readonly child: ChildProcess;
  readonly dbPath: string;
  getStderr(): string;
  /** Sends the signal to the whole process group and waits for exit. */
  stop(signal?: NodeJS.Signals): Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  /** SIGKILLs the whole process group without waiting — for "unclean kill" tests. */
  killGroup(): void;
  /** Waits for the process to exit on its own (e.g. after a SIGKILL sent elsewhere). */
  waitForExit(timeoutMs?: number): Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
}

export interface StartLiveServerOptions {
  dbPath: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

export async function startLiveServer(opts: StartLiveServerOptions): Promise<LiveServer> {
  const { dbPath, env = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;

  // detached: true so the child becomes its own process-group leader — tsx's
  // CLI re-execs itself into a child node process, so killing only the
  // directly-spawned pid can leave that real worker (and its DuckDB lock)
  // running as an orphan. stop()/killGroup() below kill the whole group.
  const child: ChildProcess = spawn(TSX_BIN, ['src/server-http.ts'], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PLANIFEST_MCP_PORT: '0',
      PLANIFEST_TELEMETRY_DB: dbPath,
      ...env,
    },
    stdio: ['ignore', 'ignore', 'pipe'],
    detached: true,
  });

  let stderrBuf = '';
  child.stderr?.on('data', (c: Buffer) => { stderrBuf += c.toString('utf8'); });

  const port = await new Promise<number>((resolvePort, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`server-http.ts did not report ready within ${timeoutMs}ms\n${stderrBuf}`));
    }, timeoutMs);

    const onData = (): void => {
      const match = READY_RE.exec(stderrBuf);
      if (match && !settled) {
        settled = true;
        clearTimeout(timer);
        child.stderr?.off('data', onData);
        resolvePort(Number(match[1]));
      }
    };
    const onExit = (code: number | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`server-http.ts exited early (code ${code})\n${stderrBuf}`));
    };

    child.stderr?.on('data', onData);
    child.once('exit', onExit);
  });

  return {
    baseURL: `http://127.0.0.1:${port}`,
    child,
    dbPath,
    getStderr: () => stderrBuf,
    async stop(signal: NodeJS.Signals = 'SIGTERM') {
      return new Promise((resolveStop) => {
        child.once('exit', (code, sig) => resolveStop({ code, signal: sig }));
        if (child.pid !== undefined) {
          process.kill(-child.pid, signal);
        } else {
          child.kill(signal);
        }
      });
    },
    killGroup() {
      if (child.pid !== undefined) {
        process.kill(-child.pid, 'SIGKILL');
      } else {
        child.kill('SIGKILL');
      }
    },
    async waitForExit(timeoutMs = DEFAULT_TIMEOUT_MS) {
      return new Promise((resolveExit, reject) => {
        const timer = setTimeout(() => reject(new Error(`process did not exit within ${timeoutMs}ms`)), timeoutMs);
        child.once('exit', (code, sig) => {
          clearTimeout(timer);
          resolveExit({ code, signal: sig });
        });
      });
    },
  };
}
