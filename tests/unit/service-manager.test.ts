/**
 * req-009: scripts/service-manager.mjs's orphan-port detection.
 *
 * service-manager.mjs is a CLI script (not covered by the rest of the
 * Vitest suite, which targets src/), but its deploy-time logic is exactly
 * the kind of "false success" bug this feature exists to close, so it gets
 * the same deterministic, dependency-injected treatment as
 * tests/unit/checkpoint.test.ts: no real launchctl/systemctl/lsof calls,
 * fake `exec` functions instead. The module guards its CLI dispatch behind
 * an import.meta.url-equals-argv[1] check (mirroring the bash scripts'
 * BASH_SOURCE guard in tests/bats/), so importing it here for its exported
 * pure functions does not trigger any real service action.
 */
import { describe, it, expect, vi } from 'vitest';
import { getManagedPid, getPortListenerPid, checkOrphanPort } from '../../scripts/service-manager.mjs';

// ── getManagedPid() ──────────────────────────────────────────────────────────

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

// ── getPortListenerPid() ─────────────────────────────────────────────────────

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

// ── checkOrphanPort() ─────────────────────────────────────────────────────────

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
