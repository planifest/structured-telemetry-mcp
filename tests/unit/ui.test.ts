/**
 * req-002/003/004-ui: the static log-viewer page (0000015, ADR-018).
 * Verifies the served HTML contains the structure the acceptance criteria
 * depend on. server-http.ts itself has no HTTP-level test coverage anywhere
 * in this project (routes are tested via server-factory.ts's exported
 * handlers) — this follows the same convention for the new GET /ui route by
 * testing the served content directly rather than spinning up a live server.
 */

import { describe, it, expect } from 'vitest';
import { INDEX_HTML } from '../../src/ui/index-html.js';

describe('req-002-event-log-table: log viewer page', () => {
  it('is a well-formed HTML document', () => {
    expect(INDEX_HTML).toContain('<!doctype html>');
    expect(INDEX_HTML).toContain('<title>Telemetry Log Viewer</title>');
  });

  it('renders an events table with the confirmed columns', () => {
    expect(INDEX_HTML).toContain('Timestamp');
    expect(INDEX_HTML).toContain('Session ID');
    expect(INDEX_HTML).toContain('Phase');
    expect(INDEX_HTML).toContain('Agent');
    expect(INDEX_HTML).toContain('Product');
  });

  it('fetches from the same-origin /query endpoint (no external calls) (NFR-003)', () => {
    expect(INDEX_HTML).toContain("fetch('/query'");
    expect(INDEX_HTML).not.toMatch(/fetch\(['"]https?:\/\//);
  });

  it('requests mode: event_log', () => {
    expect(INDEX_HTML).toContain("mode: 'event_log'");
  });

  it('shows the full product_id as a tooltip on the truncated basename (discoverability for the exact-match filter)', () => {
    expect(INDEX_HTML).toContain("'<span title=\"'");
  });

  it('includes a pagination control area', () => {
    expect(INDEX_HTML).toContain('id="pager"');
    expect(INDEX_HTML).toContain('id="prev"');
    expect(INDEX_HTML).toContain('id="next"');
  });
});

describe('req-003-event-filtering: filter controls', () => {
  it('exposes an input for every confirmed filter field', () => {
    for (const key of ['session_id', 'initiative_id', 'event_type', 'phase', 'agent', 'product_id', 'from', 'to']) {
      expect(INDEX_HTML).toContain('id="f-' + key + '"');
    }
  });

  it('has a clear-all-filters control', () => {
    expect(INDEX_HTML).toContain('id="clear-all"');
  });

  it('has an individual clear control per filter', () => {
    for (const key of ['session_id', 'initiative_id', 'event_type', 'phase', 'agent', 'product_id', 'from', 'to']) {
      expect(INDEX_HTML).toContain('data-clear="' + key + '"');
    }
  });

  it('persists filters/page/pageSize/sort in the URL query string', () => {
    expect(INDEX_HTML).toContain('writeStateToUrl');
    expect(INDEX_HTML).toContain('readStateFromUrl');
    expect(INDEX_HTML).toContain('history.replaceState');
  });

  it('resets to page 1 when filters change', () => {
    // The filter-apply and clear handlers set currentState.page = 1 before refreshing.
    const submitHandlerMatch = INDEX_HTML.match(/addEventListener\('submit'[\s\S]{0,200}/);
    expect(submitHandlerMatch).not.toBeNull();
    expect(submitHandlerMatch![0]).toContain('currentState.page = 1');
  });
});

describe('req-001-product-id-tagging: table/detail display of NULL product_id', () => {
  it('renders "unknown" for a NULL product_id in the table (not blank or an error)', () => {
    expect(INDEX_HTML).toContain('<span class="unknown">unknown</span>');
  });
});

describe('req-004-event-detail-view: row detail', () => {
  it('renders full pretty-printed JSON per row on click, with no extra fetch', () => {
    expect(INDEX_HTML).toContain('JSON.stringify(event, null, 2)');
    expect(INDEX_HTML).toContain("addEventListener('click'");
  });

  it('the row-click handler makes no network request (data already in hand)', () => {
    const clickHandlerMatch = INDEX_HTML.match(/row\.addEventListener\('click', \(\) => \{[\s\S]*?\}\);/);
    expect(clickHandlerMatch).not.toBeNull();
    expect(clickHandlerMatch![0]).not.toContain('fetch(');
  });
});

describe('error/empty states (Scope Lock, plan/current/build-log.md)', () => {
  it('shows a backend-unreachable banner on fetch failure', () => {
    expect(INDEX_HTML).toContain("Can't reach telemetry backend");
  });

  it('distinguishes "no events yet" from "no matching events"', () => {
    expect(INDEX_HTML).toContain('No events yet.');
    expect(INDEX_HTML).toContain('No matching events.');
  });
});
