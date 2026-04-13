import { describe, it, expect } from 'vitest';
import { renderMarkdownTable, buildQueryResponse } from '../../src/query/format-results.js';

describe('renderMarkdownTable', () => {
  it('returns no-results sentinel for empty rows', () => {
    const result = renderMarkdownTable(['A', 'B'], []);
    expect(result).toBe('_No results._\n');
  });

  it('renders header, separator, and data rows', () => {
    const result = renderMarkdownTable(['Phase', 'Duration'], [['codegen', 4200]]);
    expect(result).toContain('| Phase | Duration |');
    expect(result).toContain('| --- | --- |');
    expect(result).toContain('| codegen | 4200 |');
  });

  it('coerces null cells to empty string', () => {
    const result = renderMarkdownTable(['Key', 'Value'], [['a', null]]);
    expect(result).toContain('| a |  |');
  });

  it('renders multiple rows in order', () => {
    const rows: (string | number)[][] = [['spec', 8500], ['codegen', 3200], ['validate', 1200]];
    const result = renderMarkdownTable(['Phase', 'ms'], rows);
    const lines = result.trim().split('\n');
    // header + separator + 3 data rows = 5 lines
    expect(lines).toHaveLength(5);
    expect(lines[2]).toContain('spec');
    expect(lines[3]).toContain('codegen');
    expect(lines[4]).toContain('validate');
  });
});

describe('buildQueryResponse', () => {
  it('returns markdown, json, and rawSample', () => {
    const sample = [{ id: 'abc', event: 'phase_start' }];
    const aggregation = { mode: 'test', results: [] };
    const response = buildQueryResponse(['Col'], [['val']], sample, aggregation);

    expect(typeof response.markdown).toBe('string');
    expect(response.markdown).toContain('Col');
    expect(response.json).toEqual(aggregation);
    expect(response.rawSample).toEqual(sample);
  });

  it('markdown is no-results when rows are empty', () => {
    const response = buildQueryResponse(['Col'], [], [], { results: [] });
    expect(response.markdown).toBe('_No results._\n');
  });
});
