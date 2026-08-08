/**
 * P5 security finding (fixed): EXPORT/IMPORT DATABASE paths were interpolated
 * unescaped into a single-quoted SQL literal. sqlPathLiteral() doubles
 * embedded single quotes per standard SQL string-literal escaping, so a
 * PLANIFEST_TELEMETRY_BACKUP_DIR (or any path component) containing an
 * apostrophe can't break or corrupt the statement.
 */
import { describe, it, expect } from 'vitest';
import { sqlPathLiteral } from '../../src/backup/backup-service.js';

describe('sqlPathLiteral', () => {
  it('returns a path with no single quotes unchanged', () => {
    expect(sqlPathLiteral('/Users/dev/.planifest-backups/2026-08-08')).toBe(
      '/Users/dev/.planifest-backups/2026-08-08',
    );
  });

  it('doubles a single embedded single quote', () => {
    expect(sqlPathLiteral("/Users/o'brien/.planifest-backups")).toBe("/Users/o''brien/.planifest-backups");
  });

  it('doubles every occurrence when multiple quotes are present', () => {
    expect(sqlPathLiteral("it's a 'test' path")).toBe("it''s a ''test'' path");
  });

  it('produces a string that, once wrapped in single quotes, is a syntactically valid single SQL literal', () => {
    const raw = "/tmp/o'brien's backups";
    const literal = `'${sqlPathLiteral(raw)}'`;
    // A valid SQL single-quoted literal has an even number of quote
    // characters between its own opening/closing quotes when each embedded
    // quote is doubled — i.e. stripping the two literal-delimiter quotes,
    // every remaining quote must appear in a pair.
    const inner = literal.slice(1, -1);
    expect(inner.split("''").join('').includes("'")).toBe(false);
  });
});
