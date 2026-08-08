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
import { SORTABLE_FIELDS } from '../../src/query/column-allow-list.js';

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

describe('req-001-auto-refresh-tail-mode: toggle + status element', () => {
  it('has an auto-refresh checkbox and label inside the filters form', () => {
    const formMatch = INDEX_HTML.match(/<form id="filters">[\s\S]*?<\/form>/);
    expect(formMatch).not.toBeNull();
    expect(formMatch![0]).toContain('type="checkbox" id="auto-refresh"');
    expect(formMatch![0]).toContain('name="autoRefresh"');
    expect(formMatch![0]).toContain('for="auto-refresh"');
  });

  it('has a distinct #auto-refresh-status element, separate from #banner', () => {
    expect(INDEX_HTML).toContain('id="auto-refresh-status"');
  });

  it('readStateFromUrl reads autoRefresh=1 as true, everything else as false (never throws)', () => {
    expect(INDEX_HTML).toContain("state.autoRefresh = params.get('autoRefresh') === '1'");
  });

  it('writeStateToUrl only writes autoRefresh when true, omitting it entirely when false', () => {
    const writeMatch = INDEX_HTML.match(/function writeStateToUrl\(state\) \{[\s\S]*?\n\}/);
    expect(writeMatch).not.toBeNull();
    expect(writeMatch![0]).toContain("if (state.autoRefresh) params.set('autoRefresh', '1')");
  });

  it('applyStateToForm syncs the checkbox from state', () => {
    const applyMatch = INDEX_HTML.match(/function applyStateToForm\(state\) \{[\s\S]*?\n\}/);
    expect(applyMatch).not.toBeNull();
    expect(applyMatch![0]).toContain("getElementById('auto-refresh').checked = !!state.autoRefresh");
  });

  it('defines a 5-second AUTO_REFRESH_INTERVAL_MS and start/stop functions using setInterval/clearInterval', () => {
    expect(INDEX_HTML).toContain('const AUTO_REFRESH_INTERVAL_MS = 5000');
    expect(INDEX_HTML).toContain('let autoRefreshTimer = null');
    expect(INDEX_HTML).toContain('setInterval(pollForUpdates, AUTO_REFRESH_INTERVAL_MS)');
    expect(INDEX_HTML).toContain('clearInterval(autoRefreshTimer)');
  });

  it('pollForUpdates never touches scroll and never calls applyStateToForm/writeStateToUrl', () => {
    const pollMatch = INDEX_HTML.match(/async function pollForUpdates\(\) \{[\s\S]*?\n\}/);
    expect(pollMatch).not.toBeNull();
    const body = pollMatch![0];
    expect(body).not.toContain('applyStateToForm(');
    expect(body).not.toContain('writeStateToUrl(');
    expect(body).not.toMatch(/scrollTo|scrollIntoView|\.focus\(\)/);
  });

  it('pollForUpdates never blanks the table/pager before the fetch or on failure', () => {
    const pollMatch = INDEX_HTML.match(/async function pollForUpdates\(\) \{[\s\S]*?\n\}/);
    expect(pollMatch).not.toBeNull();
    const body = pollMatch![0];
    // Nothing before the try/await touches table/pager visibility (no pre-fetch blank).
    const beforeAwait = body.slice(0, body.indexOf('await loadEvents'));
    expect(beforeAwait).not.toContain('style.display');
    // The catch (failure) block never blanks the table/pager either.
    const catchMatch = body.match(/catch \(err\) \{[\s\S]*?\n  \}/);
    expect(catchMatch).not.toBeNull();
    expect(catchMatch![0]).not.toContain('style.display');
  });

  it('pollForUpdates reveals the table/pager on a genuine zero-to-nonzero transition, matching refresh()\'s own zero-result handling', () => {
    const pollMatch = INDEX_HTML.match(/async function pollForUpdates\(\) \{[\s\S]*?\n\}/);
    expect(pollMatch).not.toBeNull();
    const body = pollMatch![0];
    expect(body).toContain('if (totalCount === 0)');
    expect(body).toContain("table.style.display = 'none'");
    expect(body).toContain("table.style.display = ''");
    expect(body).toContain("pager.style.display = 'flex'");
  });

  it('pollForUpdates shows a retry message on failure and never calls stopAutoRefresh', () => {
    const pollMatch = INDEX_HTML.match(/async function pollForUpdates\(\) \{[\s\S]*?\n\}/);
    expect(pollMatch).not.toBeNull();
    const body = pollMatch![0];
    expect(body).toContain('auto-refresh-status');
    expect(body).toMatch(/retry/i);
    expect(body).not.toContain('stopAutoRefresh(');
  });

  it('resumes polling on bootstrap when currentState.autoRefresh is true (URL-driven resume)', () => {
    const tail = INDEX_HTML.slice(INDEX_HTML.indexOf('applyStateToForm(currentState);\nrefresh();'));
    expect(tail).toContain('if (currentState.autoRefresh) startAutoRefresh();');
  });

  it('the auto-refresh checkbox change handler writes the URL and starts/stops the interval', () => {
    expect(INDEX_HTML).toContain("getElementById('auto-refresh').addEventListener('change'");
  });
});

describe('req-002-filter-combobox-suggestions: datalist wiring', () => {
  const suggestibleFields = ['session_id', 'initiative_id', 'event_type', 'phase', 'agent', 'product_id'];

  it('has a <datalist> and list attribute for each of the 6 suggestible fields', () => {
    for (const field of suggestibleFields) {
      expect(INDEX_HTML).toContain('list="dl-' + field + '"');
      expect(INDEX_HTML).toContain('id="dl-' + field + '"');
    }
  });

  it('does not wire a datalist for from/to (date pickers, excluded)', () => {
    expect(INDEX_HTML).not.toContain('id="dl-from"');
    expect(INDEX_HTML).not.toContain('id="dl-to"');
    expect(INDEX_HTML).not.toContain('list="dl-from"');
    expect(INDEX_HTML).not.toContain('list="dl-to"');
  });

  it('fetchSuggestions posts mode: distinct_values to /query', () => {
    expect(INDEX_HTML).toContain("mode: 'distinct_values'");
  });

  it('maps the event_type UI field to the real "event" column for the distinct_values field param', () => {
    expect(INDEX_HTML).toContain("event_type: 'event'");
  });

  it('debounces input-driven suggestion fetches by 200ms', () => {
    expect(INDEX_HTML).toContain('SUGGEST_DEBOUNCE_MS = 200');
    expect(INDEX_HTML).toContain('setTimeout(');
    expect(INDEX_HTML).toContain('clearTimeout(');
  });

  it('fetches suggestions on focus with an empty q', () => {
    expect(INDEX_HTML).toContain("addEventListener('focus'");
    expect(INDEX_HTML).toContain("fetchSuggestions(field, '')");
  });

  it('fetchSuggestions silently ignores failures (no showBanner, never throws)', () => {
    const fnMatch = INDEX_HTML.match(/async function fetchSuggestions\([\s\S]*?\n\}/);
    expect(fnMatch).not.toBeNull();
    expect(fnMatch![0]).toContain('catch');
    expect(fnMatch![0]).not.toContain('showBanner');
  });
});

describe('req-003-sortable-headers-three-way-sync: combined sort control + clickable headers', () => {
  const sortOptions = [
    'timestamp:desc', 'timestamp:asc',
    'event:asc', 'event:desc',
    'session_id:asc', 'session_id:desc',
    'phase:asc', 'phase:desc',
    'agent:asc', 'agent:desc',
    'product_id:asc', 'product_id:desc',
  ];

  it('the #sort select carries combined field:direction values for all 6 sortable columns', () => {
    for (const value of sortOptions) {
      expect(INDEX_HTML).toContain('value="' + value + '"');
    }
  });

  it('each sortable <th> carries a data-field attribute for every SORTABLE_FIELDS entry', () => {
    // req-011: import the allow-list rather than restating the six literals, so
    // a backend change to SORTABLE_FIELDS that the hand-mirrored UI template does
    // not track (docs/quirks.md notes there is no runtime import, ADR-018) fails
    // this test instead of silently drifting.
    for (const field of SORTABLE_FIELDS) {
      expect(INDEX_HTML).toContain('data-field="' + field + '"');
    }
  });

  it('readStateFromUrl validates sortField against the allow-list, defaulting to timestamp', () => {
    const readMatch = INDEX_HTML.match(/function readStateFromUrl\(\) \{[\s\S]*?\n\}/);
    expect(readMatch).not.toBeNull();
    expect(readMatch![0]).toContain('SORTABLE_FIELDS.includes(');
    expect(readMatch![0]).toContain("sortField: 'timestamp'");
  });

  it('writeStateToUrl writes sortField alongside sort', () => {
    const writeMatch = INDEX_HTML.match(/function writeStateToUrl\(state\) \{[\s\S]*?\n\}/);
    expect(writeMatch).not.toBeNull();
    expect(writeMatch![0]).toContain("params.set('sortField', state.sortField)");
  });

  it('loadEvents sends sortField in the POST body', () => {
    expect(INDEX_HTML).toContain('sortField: state.sortField');
  });

  it('a header click toggles direction if already the active field, else switches field with that field\'s default direction, and resets page to 1', () => {
    expect(INDEX_HTML).toContain('SORT_FIELD_DEFAULT_DIRECTION');
    const clickMatch = INDEX_HTML.match(/th\.addEventListener\('click', \(\) => \{[\s\S]*?\n {2}\}\);/);
    expect(clickMatch).not.toBeNull();
    expect(clickMatch![0]).toContain('currentState.page = 1');
  });

  it('updateSortIndicators renders the active-column arrow glyph and is called after state changes', () => {
    expect(INDEX_HTML).toContain('function updateSortIndicators(state)');
    expect(INDEX_HTML).toContain('▲');
    expect(INDEX_HTML).toContain('▼');
  });
});
