/**
 * Formats query results as Markdown table, JSON payload, and raw event sample.
 * All query_telemetry responses include all three formats (REQ-002/003/004).
 */

export interface QueryResponse {
  readonly markdown: string;
  readonly json: object;
  readonly rawSample: readonly object[];
}

/** Renders a Markdown table from headers and rows. */
export function renderMarkdownTable(headers: readonly string[], rows: readonly (string | number | null)[][]): string {
  if (rows.length === 0) return '_No results._\n';

  const headerRow = `| ${headers.join(' | ')} |`;
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  const dataRows = rows.map((row) => `| ${row.map((cell) => String(cell ?? '')).join(' | ')} |`);

  return [headerRow, separator, ...dataRows].join('\n') + '\n';
}

/** Wraps aggregation results and raw sample into the standard response shape. */
export function buildQueryResponse(
  headers: readonly string[],
  rows: readonly (string | number | null)[][],
  rawSample: readonly object[],
  aggregation: object,
): QueryResponse {
  return {
    markdown: renderMarkdownTable(headers, rows),
    json: aggregation,
    rawSample,
  };
}
