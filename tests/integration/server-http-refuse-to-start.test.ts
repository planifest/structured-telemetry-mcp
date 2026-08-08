/**
 * req-004: refuse-to-start on an unopenable database (poisoned WAL, or a lock
 * held by another running instance). Spawns the real src/server-http.ts as a
 * child process — exactly what an operator/launchd/systemd invokes — against a
 * fixture database prepared by tests/integration/support/{make-poisoned-wal,
 * hold-db-lock}.ts.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const TSX_BIN = join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

interface RunResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

/** Runs a script to completion (or up to timeoutMs) and captures its output. */
function runScript(args: string[], env: NodeJS.ProcessEnv, timeoutMs = 15_000): Promise<RunResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(TSX_BIN, args, { cwd: REPO_ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`script did not exit within ${timeoutMs}ms\nstdout: ${stdout}\nstderr: ${stderr}`));
    }, timeoutMs);

    child.stdout?.on('data', (c: Buffer) => { stdout += c.toString('utf8'); });
    child.stderr?.on('data', (c: Buffer) => { stderr += c.toString('utf8'); });
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      resolvePromise({ code, signal, stdout, stderr });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/** Starts a script and resolves once it prints `readyMarker`, leaving it running. */
function startAndWaitForMarker(args: string[], env: NodeJS.ProcessEnv, readyMarker: RegExp, timeoutMs = 15_000): Promise<{ child: ChildProcess; stdout: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(TSX_BIN, args, { cwd: REPO_ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`did not see ready marker within ${timeoutMs}ms\nstdout: ${stdout}\nstderr: ${stderr}`));
    }, timeoutMs);

    child.stdout?.on('data', (c: Buffer) => {
      stdout += c.toString('utf8');
      if (!settled && readyMarker.test(stdout)) {
        settled = true;
        clearTimeout(timer);
        resolvePromise({ child, stdout });
      }
    });
    child.stderr?.on('data', (c: Buffer) => { stderr += c.toString('utf8'); });
    child.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`exited early (code ${code}) before ready marker\nstdout: ${stdout}\nstderr: ${stderr}`));
    });
  });
}

const activeDirs: string[] = [];
const activeChildren: ChildProcess[] = [];

afterEach(async () => {
  for (const child of activeChildren.splice(0)) {
    child.kill('SIGKILL');
  }
  for (const dir of activeDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('req-004: refuse to start — poisoned WAL', () => {
  it('exits 0 without opening the HTTP listener, never touching the WAL, and printing the required diagnostic', async () => {
    const dbDir = mkdtempSync(join(tmpdir(), 'telemetry-poisoned-wal-'));
    activeDirs.push(dbDir);
    const dbPath = join(dbDir, 'telemetry.db');
    const walPath = `${dbPath}.wal`;

    const fixture = await runScript(['tests/integration/support/make-poisoned-wal.ts', dbPath], { ...process.env });
    expect(fixture.code, `fixture setup failed: ${fixture.stderr}`).toBe(0);
    expect(fixture.stdout).toContain('POISONED_WAL_READY');

    const walBefore = readFileSync(walPath);
    const mtimeBefore = statSync(walPath).mtimeMs;

    const result = await runScript(['src/server-http.ts'], {
      ...process.env,
      PLANIFEST_MCP_PORT: '0',
      PLANIFEST_TELEMETRY_DB: dbPath,
    });

    // ADR-030: refuse-to-start exits 0, deliberately — not a crash, "stay stopped".
    expect(result.code).toBe(0);
    expect(result.stderr).not.toMatch(/ready — http/);

    // The WAL must be byte-identical and untouched — never deleted/truncated/modified.
    const walAfter = readFileSync(walPath);
    const mtimeAfter = statSync(walPath).mtimeMs;
    expect(walAfter.equals(walBefore)).toBe(true);
    expect(mtimeAfter).toBe(mtimeBefore);

    // Diagnostic message requirements (req-004 Functional Requirements + Acceptance Criteria).
    // Anchor on our own printed message — tsx/node may emit unrelated loader
    // deprecation warnings on stderr ahead of it in this dev harness.
    const diagnosticStart = result.stderr.indexOf('Deleting ');
    expect(diagnosticStart).toBeGreaterThanOrEqual(0);
    const diagnostic = result.stderr.slice(diagnosticStart);
    expect((diagnostic.split('\n')[0] ?? '').toLowerCase()).toContain('irreversible');
    expect(result.stderr).toContain(dbPath);
    expect(result.stderr).toContain('restore-procedure.md');
  });
});

describe('req-004: refuse to start — lock held by another instance', () => {
  it('exits 0 and names the conflicting PID', async () => {
    const dbDir = mkdtempSync(join(tmpdir(), 'telemetry-locked-'));
    activeDirs.push(dbDir);
    const dbPath = join(dbDir, 'telemetry.db');

    const { child: holder, stdout: holderStdout } = await startAndWaitForMarker(
      ['tests/integration/support/hold-db-lock.ts', dbPath],
      { ...process.env },
      /LOCK_HELD pid=(\d+)/,
    );
    activeChildren.push(holder);
    const holderPid = /LOCK_HELD pid=(\d+)/.exec(holderStdout)?.[1];
    expect(holderPid).toBeTruthy();

    const result = await runScript(['src/server-http.ts'], {
      ...process.env,
      PLANIFEST_MCP_PORT: '0',
      PLANIFEST_TELEMETRY_DB: dbPath,
    });

    expect(result.code).toBe(0);
    expect(result.stderr).not.toMatch(/ready — http/);
    expect(result.stderr).toContain(dbPath);
    expect(result.stderr).toContain(String(holderPid));

    const diagnosticStart = result.stderr.indexOf('Deleting ');
    expect(diagnosticStart).toBeGreaterThanOrEqual(0);
    const diagnostic = result.stderr.slice(diagnosticStart);
    expect((diagnostic.split('\n')[0] ?? '').toLowerCase()).toContain('irreversible');
  });
});
