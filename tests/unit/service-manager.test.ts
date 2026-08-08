/**
 * req-008 / req-009: scripts/service-manager.mjs's deploy-time checks.
 *
 * service-manager.mjs is a CLI script (not covered by the rest of the
 * Vitest suite, which targets src/), but its deploy-time logic — orphan-port
 * detection and build-identity comparison — is exactly the kind of "false
 * success" bug this feature exists to close, so it gets the same
 * deterministic, dependency-injected treatment as tests/unit/checkpoint.test.ts:
 * no real launchctl/systemctl/lsof/network calls, fake `exec`/`fetchImpl`
 * functions instead. The module guards its CLI dispatch behind an
 * import.meta.url-equals-argv[1] check (mirroring the bash scripts'
 * BASH_SOURCE guard in tests/bats/), so importing it here for its exported
 * pure functions does not trigger any real service action.
 */
import { describe, it, expect, vi } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  getManagedPid,
  getPortListenerPid,
  checkOrphanPort,
  computeBuildId,
  compareBuildIdentity,
  fetchHealthWithRetry,
  verifyBuildIdentity,
} from '../../scripts/service-manager.mjs';

// ── req-009: getManagedPid() ─────────────────────────────────────────────────

describe('req-009: getManagedPid', () => {
  it('darwin: parses the PID out of launchctl list output', () => {
    const exec = vi.fn().mockReturnValue({
      status: 0,
      stdout: '{\n\t"PID" = 18745;\n\t"Label" = "com.planifest.telemetry-mcp";\n}',
    });
    expect(getManagedPid('darwin', { exec })).toBe(18745);
    expect(exec).toHaveBeenCalledWith('launchctl', ['list', 'com.planifest.telemetry-mcp'], expect.anything());
  });

  it('darwin: returns null when the service is not loaded (non-zero exit)', () => {
    const exec = vi.fn().mockReturnValue({ status: 3, stdout: '' });
    expect(getManagedPid('darwin', { exec })).toBeNull();
  });

  it('linux: parses MainPID from systemctl show --value', () => {
    const exec = vi.fn().mockReturnValue({ status: 0, stdout: '4321\n' });
    expect(getManagedPid('linux', { exec })).toBe(4321);
  });

  it('linux: treats MainPID=0 (not running) as null, not PID 0', () => {
    const exec = vi.fn().mockReturnValue({ status: 0, stdout: '0\n' });
    expect(getManagedPid('linux', { exec })).toBeNull();
  });

  it('unsupported platform returns null without invoking exec', () => {
    const exec = vi.fn();
    expect(getManagedPid('win32', { exec })).toBeNull();
    expect(exec).not.toHaveBeenCalled();
  });
});

// ── req-009: getPortListenerPid() ────────────────────────────────────────────

describe('req-009: getPortListenerPid', () => {
  it('reports the port free when lsof returns no output', () => {
    const exec = vi.fn().mockReturnValue({ error: null, status: 1, stdout: '' });
    expect(getPortListenerPid(3741, { exec })).toEqual({ checked: true, pid: null });
  });

  it('parses the first PID out of lsof -ti output', () => {
    const exec = vi.fn().mockReturnValue({ error: null, status: 0, stdout: '99999\n' });
    expect(getPortListenerPid(3741, { exec })).toEqual({ checked: true, pid: 99999 });
  });

  it('falls back to ss when lsof is not installed', () => {
    const exec = vi.fn((cmd: string) => {
      if (cmd === 'lsof') return { error: new Error('ENOENT') };
      if (cmd === 'ss') return { error: null, status: 0, stdout: 'LISTEN 0 511 *:3741 *:*  users:(("node",pid=555,fd=20))' };
      throw new Error('unexpected command');
    });
    expect(getPortListenerPid(3741, { exec })).toEqual({ checked: true, pid: 555 });
  });

  it('reports unchecked when neither lsof nor ss is available (degrade, not a false pass)', () => {
    const exec = vi.fn().mockReturnValue({ error: new Error('ENOENT') });
    expect(getPortListenerPid(3741, { exec })).toEqual({ checked: false, pid: null });
  });
});

// ── req-009: checkOrphanPort() ───────────────────────────────────────────────

describe('req-009: checkOrphanPort', () => {
  it('passes when the port is free', () => {
    const exec = vi.fn().mockReturnValue({ error: null, status: 1, stdout: '' });
    const result = checkOrphanPort(3741, { platform: 'darwin', exec });
    expect(result).toEqual({ ok: true, reason: 'free' });
  });

  it('passes when the port is held by the launchd-managed PID (no false positive during a normal restart)', () => {
    const exec = vi.fn((cmd: string) => {
      if (cmd === 'lsof') return { error: null, status: 0, stdout: '18745\n' };
      if (cmd === 'launchctl') return { status: 0, stdout: '"PID" = 18745;' };
      throw new Error('unexpected command');
    });
    const result = checkOrphanPort(3741, { platform: 'darwin', exec });
    expect(result).toEqual({ ok: true, reason: 'managed', pid: 18745 });
  });

  it('fails and names the PID + kill command when the port is held by an unmanaged process', () => {
    const exec = vi.fn((cmd: string) => {
      if (cmd === 'lsof') return { error: null, status: 0, stdout: '99999\n' };
      if (cmd === 'launchctl') return { status: 0, stdout: '"PID" = 18745;' }; // different PID
      throw new Error('unexpected command');
    });
    const err = vi.fn();
    const result = checkOrphanPort(3741, { platform: 'darwin', exec, err });
    expect(result).toEqual({ ok: false, reason: 'orphan', pid: 99999 });
    const combined = err.mock.calls.map((c) => c[0]).join('\n');
    expect(combined).toContain('PID 99999');
    expect(combined).toContain('kill 99999');
  });

  it('fails when the service is not registered at all (no managed PID) but something holds the port', () => {
    const exec = vi.fn((cmd: string) => {
      if (cmd === 'lsof') return { error: null, status: 0, stdout: '99999\n' };
      if (cmd === 'launchctl') return { status: 3, stdout: '' }; // not loaded
      throw new Error('unexpected command');
    });
    const result = checkOrphanPort(3741, { platform: 'darwin', exec });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('orphan');
  });

  it('degrades to a warning (not a false pass, not a hard failure) when occupancy cannot be checked', () => {
    const exec = vi.fn().mockReturnValue({ error: new Error('ENOENT') });
    const log = vi.fn();
    const result = checkOrphanPort(3741, { platform: 'darwin', exec, log });
    expect(result).toEqual({ ok: true, reason: 'unchecked' });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('skipping orphan-port check'));
  });
});

// ── req-008: computeBuildId() ────────────────────────────────────────────────

describe('req-008: computeBuildId', () => {
  it('matches node:crypto SHA-256 hex of the bundle file, same as src/server-http.ts BUILD_ID', () => {
    const dir = mkdtempSync(join(tmpdir(), 'service-manager-test-'));
    const bundlePath = join(dir, 'server-http.bundle.mjs');
    const content = 'console.log("fake bundle");';
    writeFileSync(bundlePath, content);
    try {
      const expected = createHash('sha256').update(Buffer.from(content)).digest('hex');
      expect(computeBuildId(bundlePath)).toBe(expected);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns null (degrade, not throw) when the bundle file does not exist', () => {
    expect(computeBuildId('/definitely/not/a/real/path/server-http.bundle.mjs')).toBeNull();
  });
});

// ── req-008: compareBuildIdentity() ──────────────────────────────────────────

describe('req-008: compareBuildIdentity', () => {
  it('reports a match when buildId equals the computed hash', () => {
    expect(compareBuildIdentity('abc123', { buildId: 'abc123' })).toEqual({ status: 'match', buildId: 'abc123' });
  });

  it('reports a mismatch — catching a same-version redeploy, not just a version-string diff', () => {
    expect(compareBuildIdentity('newhash', { version: '1.2.3', buildId: 'oldhash' })).toEqual({
      status: 'mismatch',
      computedId: 'newhash',
      remoteId: 'oldhash',
    });
  });

  it('reports unknown (not a false pass) when /health has no buildId field at all', () => {
    expect(compareBuildIdentity('newhash', { ok: true, version: '1.2.3' })).toEqual({ status: 'unknown' });
  });

  it('reports unknown when buildId is explicitly null (a bundle-less dev daemon)', () => {
    expect(compareBuildIdentity('newhash', { buildId: null })).toEqual({ status: 'unknown' });
  });
});

// ── req-008: fetchHealthWithRetry() ──────────────────────────────────────────

describe('req-008: fetchHealthWithRetry', () => {
  it('returns the parsed health body on the first successful attempt', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ buildId: 'abc' }) });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const result = await fetchHealthWithRetry(3741, { fetchImpl, sleep, retries: 3 });
    expect(result).toEqual({ buildId: 'abc' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries on connection failure and succeeds once the daemon comes up', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ buildId: 'abc' }) });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const result = await fetchHealthWithRetry(3741, { fetchImpl, sleep, retries: 5 });
    expect(result).toEqual({ buildId: 'abc' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting retries', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(fetchHealthWithRetry(3741, { fetchImpl, sleep, retries: 3 })).rejects.toThrow('ECONNREFUSED');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

// ── req-008: verifyBuildIdentity() (the assembled post-restart check) ───────

describe('req-008: verifyBuildIdentity', () => {
  it('passes when the freshly-built hash equals /health buildId', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'service-manager-test-'));
    const bundlePath = join(dir, 'server-http.bundle.mjs');
    const content = 'console.log("build A");';
    writeFileSync(bundlePath, content);
    try {
      const hash = createHash('sha256').update(Buffer.from(content)).digest('hex');
      const fetchHealth = vi.fn().mockResolvedValue({ ok: true, version: '1.0.0', buildId: hash });
      const ok = await verifyBuildIdentity(3741, bundlePath, { fetchHealth });
      expect(ok).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails and prints both identities on a same-version redeploy that did not actually take effect', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'service-manager-test-'));
    const bundlePath = join(dir, 'server-http.bundle.mjs');
    writeFileSync(bundlePath, 'console.log("build B — the new one");');
    try {
      const fetchHealth = vi.fn().mockResolvedValue({ ok: true, version: '1.0.0', buildId: 'stale-hash-from-old-process' });
      const err = vi.fn();
      const ok = await verifyBuildIdentity(3741, bundlePath, { fetchHealth, err });
      expect(ok).toBe(false);
      const combined = err.mock.calls.map((c) => c[0]).join('\n');
      expect(combined).toContain('stale-hash-from-old-process');
      expect(combined).toContain('mismatch');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('warns (does not hard-fail) when the daemon predates this feature and reports no buildId', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'service-manager-test-'));
    const bundlePath = join(dir, 'server-http.bundle.mjs');
    writeFileSync(bundlePath, 'console.log("build");');
    try {
      const fetchHealth = vi.fn().mockResolvedValue({ ok: true, version: '1.0.0' });
      const log = vi.fn();
      const ok = await verifyBuildIdentity(3741, bundlePath, { fetchHealth, log });
      expect(ok).toBe(true);
      const combined = log.mock.calls.map((c) => c[0]).join('\n');
      expect(combined).toContain('no buildId');
      expect(combined).toContain('manual restart');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails when /health cannot be reached at all', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'service-manager-test-'));
    const bundlePath = join(dir, 'server-http.bundle.mjs');
    writeFileSync(bundlePath, 'console.log("build");');
    try {
      const fetchHealth = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const err = vi.fn();
      const ok = await verifyBuildIdentity(3741, bundlePath, { fetchHealth, err });
      expect(ok).toBe(false);
      expect(err).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('degrades to a skip when the bundle itself cannot be found (never blocks deploy on this alone)', async () => {
    const fetchHealth = vi.fn();
    const log = vi.fn();
    const ok = await verifyBuildIdentity(3741, '/no/such/bundle.mjs', { fetchHealth, log });
    expect(ok).toBe(true);
    expect(fetchHealth).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('bundle not found'));
  });
});
