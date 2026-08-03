/**
 * Static log-viewer page (req-002/003/004, ADR-018).
 *
 * Embedded as a single template-literal string — same reason the JSON schema
 * is inline-imported (see src/validation/ajv-instance.ts comments): runtime
 * path resolution to sibling files breaks once esbuild bundles server-http.ts
 * into a single .mjs file. No build step, no bundler, no new dependency —
 * plain HTML/CSS/vanilla JS (ES modules) served as-is.
 */

export const INDEX_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Telemetry Log Viewer</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 1.5rem; font-size: 14px; }
  h1 { font-size: 1.25rem; margin: 0 0 1rem; }
  #banner { display: none; background: #7a1f1f; color: #fff; padding: 0.75rem 1rem; border-radius: 6px; margin-bottom: 1rem; }
  #banner.visible { display: block; }
  form#filters { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: end; margin-bottom: 1rem; }
  .field { display: flex; flex-direction: column; gap: 0.15rem; }
  .field label { font-size: 0.7rem; opacity: 0.7; }
  .field-row { display: flex; gap: 0.25rem; align-items: center; }
  input, select, button { font: inherit; padding: 0.3rem 0.5rem; border-radius: 4px; border: 1px solid #8888; background: transparent; color: inherit; }
  button { cursor: pointer; }
  button.clear { padding: 0.2rem 0.4rem; opacity: 0.6; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid #8884; font-size: 0.85rem; vertical-align: top; }
  tr.event-row { cursor: pointer; }
  tr.event-row:hover { background: #8882; }
  pre { white-space: pre-wrap; word-break: break-word; background: #8881; padding: 0.75rem; border-radius: 6px; margin: 0; }
  #pager { display: flex; gap: 0.75rem; align-items: center; margin-top: 1rem; }
  #status { opacity: 0.7; margin: 1rem 0; }
  .unknown { opacity: 0.5; font-style: italic; }
</style>
</head>
<body>
<h1>Telemetry Log Viewer</h1>
<div id="banner"></div>

<form id="filters">
  <div class="field"><label for="f-session_id">session_id</label>
    <div class="field-row"><input id="f-session_id" name="session_id" list="dl-session_id"><button type="button" class="clear" data-clear="session_id">&times;</button></div>
    <datalist id="dl-session_id"></datalist>
  </div>
  <div class="field"><label for="f-initiative_id">initiative_id</label>
    <div class="field-row"><input id="f-initiative_id" name="initiative_id" list="dl-initiative_id"><button type="button" class="clear" data-clear="initiative_id">&times;</button></div>
    <datalist id="dl-initiative_id"></datalist>
  </div>
  <div class="field"><label for="f-event_type">event_type</label>
    <div class="field-row"><input id="f-event_type" name="event_type" list="dl-event_type"><button type="button" class="clear" data-clear="event_type">&times;</button></div>
    <datalist id="dl-event_type"></datalist>
  </div>
  <div class="field"><label for="f-phase">phase</label>
    <div class="field-row"><input id="f-phase" name="phase" list="dl-phase"><button type="button" class="clear" data-clear="phase">&times;</button></div>
    <datalist id="dl-phase"></datalist>
  </div>
  <div class="field"><label for="f-agent">agent</label>
    <div class="field-row"><input id="f-agent" name="agent" list="dl-agent"><button type="button" class="clear" data-clear="agent">&times;</button></div>
    <datalist id="dl-agent"></datalist>
  </div>
  <div class="field"><label for="f-product_id">product_id</label>
    <div class="field-row"><input id="f-product_id" name="product_id" list="dl-product_id"><button type="button" class="clear" data-clear="product_id">&times;</button></div>
    <datalist id="dl-product_id"></datalist>
  </div>
  <div class="field"><label for="f-from">from</label>
    <div class="field-row"><input id="f-from" name="from" type="datetime-local"><button type="button" class="clear" data-clear="from">&times;</button></div>
  </div>
  <div class="field"><label for="f-to">to</label>
    <div class="field-row"><input id="f-to" name="to" type="datetime-local"><button type="button" class="clear" data-clear="to">&times;</button></div>
  </div>
  <div class="field">
    <button type="submit">Apply filters</button>
  </div>
  <div class="field">
    <button type="button" id="clear-all">Clear all filters</button>
  </div>
  <div class="field"><label for="sort">Sort</label>
    <select id="sort" name="sort">
      <option value="timestamp:desc">Timestamp (newest first)</option>
      <option value="timestamp:asc">Timestamp (oldest first)</option>
      <option value="event:asc">Event (A-Z)</option>
      <option value="event:desc">Event (Z-A)</option>
      <option value="session_id:asc">Session ID (A-Z)</option>
      <option value="session_id:desc">Session ID (Z-A)</option>
      <option value="phase:asc">Phase (A-Z)</option>
      <option value="phase:desc">Phase (Z-A)</option>
      <option value="agent:asc">Agent (A-Z)</option>
      <option value="agent:desc">Agent (Z-A)</option>
      <option value="product_id:asc">Product (A-Z)</option>
      <option value="product_id:desc">Product (Z-A)</option>
    </select>
  </div>
  <div class="field"><label for="pageSize">Page size</label>
    <select id="pageSize" name="pageSize">
      <option value="10">10</option>
      <option value="25">25</option>
      <option value="50" selected>50</option>
      <option value="100">100</option>
    </select>
  </div>
  <div class="field">
    <div class="field-row"><input type="checkbox" id="auto-refresh" name="autoRefresh"><label for="auto-refresh">Auto-refresh</label></div>
  </div>
</form>

<div id="status"></div>
<span id="auto-refresh-status"></span>
<table id="events-table" style="display:none">
  <thead>
    <tr>
      <th class="th-sort" data-field="timestamp">Timestamp</th>
      <th class="th-sort" data-field="event">Event</th>
      <th class="th-sort" data-field="session_id">Session ID</th>
      <th class="th-sort" data-field="phase">Phase</th>
      <th class="th-sort" data-field="agent">Agent</th>
      <th class="th-sort" data-field="product_id">Product</th>
    </tr>
  </thead>
  <tbody id="events-body"></tbody>
</table>

<div id="pager" style="display:none">
  <button type="button" id="prev">&larr; Prev</button>
  <span id="page-label"></span>
  <button type="button" id="next">Next &rarr;</button>
</div>

<script type="module">
const FILTER_KEYS = ['session_id', 'initiative_id', 'event_type', 'phase', 'agent', 'product_id', 'from', 'to'];

// req-003: allow-listed sortField values, mirroring src/query/column-allow-list.ts's
// SORTABLE_FIELDS (kept in sync manually — this template has no import mechanism, ADR-018).
const SORTABLE_FIELDS = ['timestamp', 'event', 'session_id', 'phase', 'agent', 'product_id'];
const SORT_FIELD_LABELS = {
  timestamp: 'Timestamp',
  event: 'Event',
  session_id: 'Session ID',
  phase: 'Phase',
  agent: 'Agent',
  product_id: 'Product',
};
const SORT_FIELD_DEFAULT_DIRECTION = {
  timestamp: 'desc',
  event: 'asc',
  session_id: 'asc',
  phase: 'asc',
  agent: 'asc',
  product_id: 'asc',
};

// req-002: the six suggestible filter fields. The UI/form field name is
// 'event_type', but the backend's distinct_values field allow-list uses the
// real column name 'event' for that one field — everything else is 1:1.
const SUGGESTIBLE_FIELDS = ['session_id', 'initiative_id', 'event_type', 'phase', 'agent', 'product_id'];
const SUGGEST_FIELD_COLUMN = {
  session_id: 'session_id',
  initiative_id: 'initiative_id',
  event_type: 'event',
  phase: 'phase',
  agent: 'agent',
  product_id: 'product_id',
};
const SUGGEST_DEBOUNCE_MS = 200;

function readStateFromUrl() {
  const params = new URLSearchParams(location.search);
  const state = { page: 1, pageSize: 50, sort: 'desc', sortField: 'timestamp', filters: {}, autoRefresh: false };
  for (const key of FILTER_KEYS) {
    const v = params.get(key);
    if (v) state.filters[key] = v;
  }
  const page = parseInt(params.get('page') || '', 10);
  if (Number.isFinite(page) && page > 0) state.page = page;
  const pageSize = parseInt(params.get('pageSize') || '', 10);
  if (Number.isFinite(pageSize) && pageSize > 0) state.pageSize = pageSize;
  if (params.get('sort') === 'asc') state.sort = 'asc';
  const sortField = params.get('sortField');
  if (sortField && SORTABLE_FIELDS.includes(sortField)) state.sortField = sortField;
  state.autoRefresh = params.get('autoRefresh') === '1';
  return state;
}

function writeStateToUrl(state) {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    if (state.filters[key]) params.set(key, state.filters[key]);
  }
  params.set('page', String(state.page));
  params.set('pageSize', String(state.pageSize));
  params.set('sort', state.sort);
  params.set('sortField', state.sortField);
  if (state.autoRefresh) params.set('autoRefresh', '1');
  history.replaceState(null, '', location.pathname + '?' + params.toString());
}

function applyStateToForm(state) {
  for (const key of FILTER_KEYS) {
    const el = document.getElementById('f-' + key);
    if (el) el.value = state.filters[key] || '';
  }
  document.getElementById('sort').value = state.sortField + ':' + state.sort;
  document.getElementById('pageSize').value = String(state.pageSize);
  document.getElementById('auto-refresh').checked = !!state.autoRefresh;
  updateSortIndicators(state);
}

function readFormIntoFilters(state) {
  state.filters = {};
  for (const key of FILTER_KEYS) {
    const el = document.getElementById('f-' + key);
    const v = el && el.value.trim();
    if (v) state.filters[key] = v;
  }
  const sortValue = (document.getElementById('sort').value || '').split(':');
  state.sortField = SORTABLE_FIELDS.includes(sortValue[0]) ? sortValue[0] : 'timestamp';
  state.sort = sortValue[1] === 'asc' ? 'asc' : 'desc';
  state.pageSize = parseInt(document.getElementById('pageSize').value, 10) || 50;
}

function updateSortIndicators(state) {
  document.querySelectorAll('th.th-sort').forEach((th) => {
    const field = th.getAttribute('data-field');
    const label = SORT_FIELD_LABELS[field] || field;
    const glyph = field === state.sortField ? (state.sort === 'asc' ? ' ▲' : ' ▼') : '';
    th.textContent = label + glyph;
  });
}

function showBanner(message) {
  const banner = document.getElementById('banner');
  banner.textContent = message;
  banner.classList.add('visible');
}

function hideBanner() {
  document.getElementById('banner').classList.remove('visible');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadEvents(state) {
  const body = {
    mode: 'event_log',
    limit: state.pageSize,
    offset: (state.page - 1) * state.pageSize,
    sort: state.sort,
    sortField: state.sortField,
    ...state.filters,
  };
  const res = await fetch('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error((errBody.errors && errBody.errors[0]) || ('HTTP ' + res.status));
  }
  return res.json();
}

// req-002: populates the given field's <datalist> with distinct-value suggestions.
// Never throws — a failed/empty lookup silently leaves the datalist as-is (or empty),
// and never touches the showBanner/#banner error path used by the main event query.
async function fetchSuggestions(field, q) {
  const column = SUGGEST_FIELD_COLUMN[field] || field;
  try {
    const res = await fetch('/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'distinct_values', field: column, q }),
    });
    if (!res.ok) return;
    const data = await res.json();
    const values = (data.json && data.json.values) || [];
    const datalist = document.getElementById('dl-' + field);
    if (!datalist) return;
    datalist.innerHTML = '';
    for (const value of values) {
      const option = document.createElement('option');
      option.value = value;
      datalist.appendChild(option);
    }
  } catch (err) {
    // Suggestion lookups are best-effort and independent of the main event-log query.
  }
}

function renderTable(events) {
  const tbody = document.getElementById('events-body');
  tbody.innerHTML = '';
  for (const event of events) {
    const row = document.createElement('tr');
    row.className = 'event-row';
    const productLabel = event.product_id
      ? '<span title="' + escapeHtml(event.product_id) + '">' + escapeHtml(String(event.product_id).split(/[\\\\/]/).pop()) + '</span>'
      : '<span class="unknown">unknown</span>';
    row.innerHTML =
      '<td>' + escapeHtml(event.timestamp || '') + '</td>' +
      '<td>' + escapeHtml(event.event || '') + '</td>' +
      '<td>' + escapeHtml(event.session_id || '') + '</td>' +
      '<td>' + escapeHtml(event.phase || '') + '</td>' +
      '<td>' + escapeHtml(event.agent || '') + '</td>' +
      '<td>' + productLabel + '</td>';

    const detailRow = document.createElement('tr');
    detailRow.style.display = 'none';
    const detailCell = document.createElement('td');
    detailCell.colSpan = 6;
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(event, null, 2);
    detailCell.appendChild(pre);
    detailRow.appendChild(detailCell);

    row.addEventListener('click', () => {
      detailRow.style.display = detailRow.style.display === 'none' ? '' : 'none';
    });

    tbody.appendChild(row);
    tbody.appendChild(detailRow);
  }
}

let currentState = readStateFromUrl();

// req-001: auto-refresh polling. Kept separate from refresh() so a poll tick never
// blanks the table, never touches scroll, and never re-applies form state.
let autoRefreshTimer = null;
const AUTO_REFRESH_INTERVAL_MS = 5000;

function startAutoRefresh() {
  if (autoRefreshTimer) return;
  autoRefreshTimer = setInterval(pollForUpdates, AUTO_REFRESH_INTERVAL_MS);
}

function stopAutoRefresh() {
  clearInterval(autoRefreshTimer);
  autoRefreshTimer = null;
  document.getElementById('auto-refresh-status').textContent = '';
}

async function refresh() {
  const statusEl = document.getElementById('status');
  const table = document.getElementById('events-table');
  const pager = document.getElementById('pager');

  writeStateToUrl(currentState);
  updateSortIndicators(currentState);
  hideBanner();
  statusEl.textContent = 'Loading…';
  table.style.display = 'none';
  pager.style.display = 'none';

  let data;
  try {
    data = await loadEvents(currentState);
  } catch (err) {
    statusEl.textContent = '';
    showBanner("Can't reach telemetry backend — is the service running? (" + err.message + ')');
    return;
  }

  const json = data.json || {};
  const events = json.events || [];
  const totalCount = json.total_count || 0;
  const hasFilters = Object.keys(currentState.filters).length > 0;

  if (totalCount === 0) {
    table.style.display = 'none';
    pager.style.display = 'none';
    if (hasFilters) {
      statusEl.textContent = 'No matching events.' + (json.hint ? ' ' + json.hint : '');
    } else {
      statusEl.textContent = 'No events yet.';
    }
    return;
  }

  statusEl.textContent = '';
  table.style.display = '';
  pager.style.display = 'flex';
  renderTable(events);

  const totalPages = Math.max(1, Math.ceil(totalCount / currentState.pageSize));
  document.getElementById('page-label').textContent = 'Page ' + currentState.page + ' of ' + totalPages + ' (' + totalCount + ' events)';
  document.getElementById('prev').disabled = currentState.page <= 1;
  document.getElementById('next').disabled = currentState.page >= totalPages;
}

// req-001: reuses loadEvents()/renderTable(). Never blanks the table/pager before the
// fetch or on failure (rows stay visible/unchanged while a poll is in flight or fails),
// never touches scroll, and never calls applyStateToForm()/writeStateToUrl() — a poll
// tick only updates rendered row data and pager labels, leaving currentState's filters/
// sort/page untouched and any in-progress (unsubmitted) filter typing undisturbed. On a
// genuine zero-result response it toggles visibility exactly like refresh() does, so a
// poll that finds new rows after starting from an empty state actually reveals them.
async function pollForUpdates() {
  const statusEl = document.getElementById('auto-refresh-status');
  const table = document.getElementById('events-table');
  const pager = document.getElementById('pager');
  const mainStatusEl = document.getElementById('status');
  let data;
  try {
    data = await loadEvents(currentState);
  } catch (err) {
    statusEl.textContent = 'Auto-refresh failed — retrying…';
    return;
  }

  statusEl.textContent = '';
  const json = data.json || {};
  const events = json.events || [];
  const totalCount = json.total_count || 0;
  const hasFilters = Object.keys(currentState.filters).length > 0;

  if (totalCount === 0) {
    table.style.display = 'none';
    pager.style.display = 'none';
    mainStatusEl.textContent = hasFilters
      ? 'No matching events.' + (json.hint ? ' ' + json.hint : '')
      : 'No events yet.';
    return;
  }

  mainStatusEl.textContent = '';
  table.style.display = '';
  pager.style.display = 'flex';
  renderTable(events);

  const totalPages = Math.max(1, Math.ceil(totalCount / currentState.pageSize));
  document.getElementById('page-label').textContent = 'Page ' + currentState.page + ' of ' + totalPages + ' (' + totalCount + ' events)';
  document.getElementById('prev').disabled = currentState.page <= 1;
  document.getElementById('next').disabled = currentState.page >= totalPages;
}

document.getElementById('filters').addEventListener('submit', (e) => {
  e.preventDefault();
  readFormIntoFilters(currentState);
  currentState.page = 1;
  refresh();
});

document.getElementById('sort').addEventListener('change', () => {
  readFormIntoFilters(currentState);
  refresh();
});

document.getElementById('pageSize').addEventListener('change', () => {
  readFormIntoFilters(currentState);
  currentState.page = 1;
  refresh();
});

document.getElementById('clear-all').addEventListener('click', () => {
  currentState.filters = {};
  currentState.page = 1;
  applyStateToForm(currentState);
  refresh();
});

document.querySelectorAll('button.clear').forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.getAttribute('data-clear');
    delete currentState.filters[key];
    currentState.page = 1;
    applyStateToForm(currentState);
    refresh();
  });
});

document.getElementById('prev').addEventListener('click', () => {
  if (currentState.page > 1) { currentState.page -= 1; refresh(); }
});

document.getElementById('next').addEventListener('click', () => {
  currentState.page += 1;
  refresh();
});

// req-003: clicking a column header sorts by that field — first click on a new
// field always sorts (using that field's default direction); clicking the
// already-active field toggles direction. Either way, page resets to 1.
document.querySelectorAll('th.th-sort').forEach((th) => {
  th.addEventListener('click', () => {
    const field = th.getAttribute('data-field');
    if (currentState.sortField === field) {
      currentState.sort = currentState.sort === 'asc' ? 'desc' : 'asc';
    } else {
      currentState.sortField = field;
      currentState.sort = SORT_FIELD_DEFAULT_DIRECTION[field] || 'asc';
    }
    currentState.page = 1;
    applyStateToForm(currentState);
    refresh();
  });
});

// req-001: toggling auto-refresh writes the URL immediately, but does not trigger
// an extra fetch — the table is already current from the last refresh()/poll tick.
document.getElementById('auto-refresh').addEventListener('change', (e) => {
  currentState.autoRefresh = e.target.checked;
  writeStateToUrl(currentState);
  if (currentState.autoRefresh) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
});

// req-002: fetch suggestions on focus (empty q, top 20) and on debounced input.
const suggestionTimers = {};
for (const field of SUGGESTIBLE_FIELDS) {
  const input = document.getElementById('f-' + field);
  if (!input) continue;
  input.addEventListener('focus', () => {
    fetchSuggestions(field, '');
  });
  input.addEventListener('input', () => {
    clearTimeout(suggestionTimers[field]);
    suggestionTimers[field] = setTimeout(() => {
      fetchSuggestions(field, input.value.trim());
    }, SUGGEST_DEBOUNCE_MS);
  });
}

applyStateToForm(currentState);
refresh();
if (currentState.autoRefresh) startAutoRefresh();
</script>
</body>
</html>
`;
