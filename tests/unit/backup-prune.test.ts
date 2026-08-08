/**
 * req-006: pruneRetainedSet's retention math, tested directly against
 * synthetic on-disk artifact directories (no DuckDB involved) so the 7
 * daily + 4 weekly bucketing logic is verifiable in isolation, including
 * the "once enough backups have accumulated" cold-prune case (acceptance
 * criteria) without needing 40 real sequential backup runs.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pruneRetainedSet, RETAIN_DAILY, RETAIN_WEEKLY } from '../../src/backup/backup-service.js';

const activeDirs: string[] = [];

afterEach(() => {
  for (const dir of activeDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'telemetry-prune-'));
  activeDirs.push(dir);
  return dir;
}

function stampFor(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

/** Creates an artifact directory `ageDays` days older than `now`, returning its stamp name. */
function makeArtifact(backupDir: string, now: Date, ageDays: number): string {
  const date = new Date(now.getTime() - ageDays * 24 * 60 * 60 * 1000);
  const stamp = stampFor(date);
  mkdirSync(join(backupDir, stamp), { recursive: true });
  return stamp;
}

function listRetained(backupDir: string): string[] {
  return readdirSync(backupDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
}

describe('req-006: pruneRetainedSet — below the retention threshold', () => {
  it('keeps every artifact when fewer than RETAIN_DAILY exist', () => {
    const dir = freshDir();
    const now = new Date('2026-08-08T00:00:00.000Z');
    const stamps = [0, 1, 2].map((age) => makeArtifact(dir, now, age));

    pruneRetainedSet(dir, stamps[0] ?? '', () => {}, now);

    expect(listRetained(dir)).toEqual([...stamps].sort());
  });
});

describe('req-006: pruneRetainedSet — cold prune once enough backups have accumulated', () => {
  it('keeps exactly 7 daily + 4 weekly (11 total) out of 40 pre-existing daily-cadence artifacts', () => {
    const dir = freshDir();
    const now = new Date('2026-08-08T00:00:00.000Z');
    const stamps: string[] = [];
    for (let age = 0; age < 40; age++) stamps.push(makeArtifact(dir, now, age));

    pruneRetainedSet(dir, stamps[0] ?? '', () => {}, now);

    const retained = listRetained(dir);
    expect(retained).toHaveLength(RETAIN_DAILY + RETAIN_WEEKLY);

    // The 7 most recent (ages 0-6) must all survive verbatim.
    const dailyExpected = stamps.slice(0, RETAIN_DAILY).sort();
    for (const s of dailyExpected) expect(retained).toContain(s);
  });
});

describe('req-006: pruneRetainedSet — never touches tmp/scratch leftovers or foreign entries', () => {
  it('leaves dot-prefixed directories and non-directory files untouched', () => {
    const dir = freshDir();
    const now = new Date('2026-08-08T00:00:00.000Z');
    for (let age = 0; age < 40; age++) makeArtifact(dir, now, age);

    mkdirSync(join(dir, '.tmp-leftover-from-a-failed-run'));
    writeFileSync(join(dir, 'latest-verified-backup.json'), '{}');

    pruneRetainedSet(dir, 'nonexistent', () => {}, now);

    expect(existsSync(join(dir, '.tmp-leftover-from-a-failed-run'))).toBe(true);
    expect(existsSync(join(dir, 'latest-verified-backup.json'))).toBe(true);
  });
});

describe('req-006: pruneRetainedSet — never removes the artifact just promoted', () => {
  it('keeps justPromotedName even when the set already holds 7 daily + 4 weekly', () => {
    const dir = freshDir();
    const now = new Date('2026-08-08T00:00:00.000Z');
    for (let age = 1; age < 40; age++) makeArtifact(dir, now, age);
    // The artifact just promoted this run — age 0, i.e. "now" itself.
    const justPromoted = makeArtifact(dir, now, 0);

    pruneRetainedSet(dir, justPromoted, () => {}, now);

    expect(listRetained(dir)).toContain(justPromoted);
  });
});

describe('req-006: pruneRetainedSet — stable across repeated daily prunes (no thrashing)', () => {
  it('never exceeds 7 daily + 4 weekly even after 60 consecutive daily promote+prune cycles', () => {
    const dir = freshDir();
    let maxSeen = 0;

    for (let day = 0; day <= 60; day++) {
      const now = new Date(Date.UTC(2026, 0, 1 + day));
      const stamp = stampFor(now);
      mkdirSync(join(dir, stamp), { recursive: true });
      pruneRetainedSet(dir, stamp, () => {}, now);
      maxSeen = Math.max(maxSeen, listRetained(dir).length);
    }

    expect(maxSeen).toBeLessThanOrEqual(RETAIN_DAILY + RETAIN_WEEKLY);
    expect(listRetained(dir)).toHaveLength(RETAIN_DAILY + RETAIN_WEEKLY);
  });
});
