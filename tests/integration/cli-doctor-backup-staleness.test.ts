/**
 * req-007: `doctor` reports verified-backup staleness by reading req-006's
 * sidecar metadata file — never by opening telemetry.db directly. Spawns the
 * real src/cli.ts doctor command as a child process (as an operator would
 * run `npm run doctor`), matching the pattern in
 * server-http-refuse-to-start.test.ts.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const TSX_BIN = join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runDoctor(env: NodeJS.ProcessEnv, timeoutMs = 15_000): Promise<RunResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(TSX_BIN, ['src/cli.ts', 'doctor'], { cwd: REPO_ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`doctor did not exit within ${timeoutMs}ms\nstdout: ${stdout}\nstderr: ${stderr}`));
    }, timeoutMs);

    child.stdout?.on('data', (c: Buffer) => { stdout += c.toString('utf8'); });
    child.stderr?.on('data', (c: Buffer) => { stderr += c.toString('utf8'); });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolvePromise({ code, stdout, stderr });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/** Fixture: opens the given DuckDB path and holds it open, printing a ready marker. */
function startLockHolder(dbPath: string, timeoutMs = 15_000): Promise<{ child: ChildProcess; pid: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(TSX_BIN, ['tests/integration/support/hold-db-lock.ts', dbPath], {
      cwd: REPO_ROOT,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`lock holder did not report ready within ${timeoutMs}ms\nstdout: ${stdout}`));
    }, timeoutMs);
    child.stdout?.on('data', (c: Buffer) => {
      stdout += c.toString('utf8');
      const m = /LOCK_HELD pid=(\d+)/.exec(stdout);
      if (m?.[1] !== undefined) {
        clearTimeout(timer);
        resolvePromise({ child, pid: m[1] });
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`lock holder exited early (code ${code})`));
    });
  });
}

const activeDirs: string[] = [];
const activeChildren: ChildProcess[] = [];

afterEach(() => {
  for (const child of activeChildren.splice(0)) {
    child.kill('SIGKILL');
  }
  for (const dir of activeDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function freshEnv(dbPath: string, backupDir: string): NodeJS.ProcessEnv {
  return { ...process.env, PLANIFEST_TELEMETRY_DB: dbPath, PLANIFEST_TELEMETRY_BACKUP_DIR: backupDir };
}

describe('req-007: doctor — no verified backup', () => {
  it('reports "no verified backup" as a distinct, non-error state when the sidecar file has never been written', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'telemetry-doctor-absent-'));
    activeDirs.push(dir);
    const dbPath = join(dir, 'telemetry.db');
    const backupDir = join(dir, 'backups'); // deliberately never created

    const result = await runDoctor(freshEnv(dbPath, backupDir));

    expect(result.stdout.toLowerCase()).toContain('no verified backup');
    expect(result.stdout.toLowerCase()).not.toContain('malformed');
  });
});

describe('req-007: doctor — verified backup exists', () => {
  it('reports the age and row count of the most recent verified backup', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'telemetry-doctor-verified-'));
    activeDirs.push(dir);
    const dbPath = join(dir, 'telemetry.db');
    const backupDir = join(dir, 'backups');
    mkdirSync(backupDir, { recursive: true });
    writeFileSync(
      join(backupDir, 'latest-verified-backup.json'),
      JSON.stringify({ timestamp: new Date(Date.now() - 60_000).toISOString(), rowCount: 4321, artifactPath: join(backupDir, '2026-08-01') }),
    );

    const result = await runDoctor(freshEnv(dbPath, backupDir));

    expect(result.stdout).toContain('4321');
    expect(result.stdout.toLowerCase()).not.toContain('no verified backup');
    expect(result.stdout.toLowerCase()).not.toContain('malformed');
  });
});

describe('req-007: doctor — malformed sidecar metadata', () => {
  it('reports a distinct warning, not a crash and not a false "no verified backup"', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'telemetry-doctor-malformed-'));
    activeDirs.push(dir);
    const dbPath = join(dir, 'telemetry.db');
    const backupDir = join(dir, 'backups');
    mkdirSync(backupDir, { recursive: true });
    writeFileSync(join(backupDir, 'latest-verified-backup.json'), '{ this is not valid json');

    const result = await runDoctor(freshEnv(dbPath, backupDir));

    expect(result.code).not.toBeNull();
    expect(result.stdout.toLowerCase()).toContain('malformed');
    expect(result.stdout.toLowerCase()).not.toContain('no verified backup');
  });
});

describe('req-007: doctor — existing checks unaffected', () => {
  it('still runs the server-bundle, DB-directory, and DuckDB write-test checks alongside the new backup check', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'telemetry-doctor-unaffected-'));
    activeDirs.push(dir);
    const dbPath = join(dir, 'telemetry.db');
    const backupDir = join(dir, 'backups');

    const result = await runDoctor(freshEnv(dbPath, backupDir));

    expect(result.stdout).toContain('server.bundle.mjs exists');
    expect(result.stdout).toContain('Telemetry DB directory writable');
    expect(result.stdout).toContain('DuckDB write test event');
  });
});

describe('req-007: doctor — backup check works even while the daemon holds the DuckDB lock', () => {
  it('does not fail or hang on the backup-staleness check when telemetry.db is locked by another process', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'telemetry-doctor-locked-'));
    activeDirs.push(dir);
    const dbPath = join(dir, 'telemetry.db');
    const backupDir = join(dir, 'backups');
    mkdirSync(backupDir, { recursive: true });
    writeFileSync(
      join(backupDir, 'latest-verified-backup.json'),
      JSON.stringify({ timestamp: new Date().toISOString(), rowCount: 7, artifactPath: join(backupDir, '2026-08-01') }),
    );

    const { child: holder } = await startLockHolder(dbPath);
    activeChildren.push(holder);

    const result = await runDoctor(freshEnv(dbPath, backupDir));

    // Regardless of what the (pre-existing, separately-owned) DuckDB
    // write-test check does under lock contention, the new backup check
    // must still have run and reported cleanly.
    expect(result.stdout).toContain('7');
    expect(result.stdout.toLowerCase()).not.toContain('no verified backup');
  });
});
