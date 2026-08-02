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
    <div class="field-row"><input id="f-session_id" name="session_id"><button type="button" class="clear" data-clear="session_id">&times;</button></div>
  </div>
  <div class="field"><label for="f-initiative_id">initiative_id</label>
    <div class="field-row"><input id="f-initiative_id" name="initiative_id"><button type="button" class="clear" data-clear="initiative_id">&times;</button></div>
  </div>
  <div class="field"><label for="f-event_type">event_type</label>
    <div class="field-row"><input id="f-event_type" name="event_type"><button type="button" class="clear" data-clear="event_type">&times;</button></div>
  </div>
  <div class="field"><label for="f-phase">phase</label>
    <div class="field-row"><input id="f-phase" name="phase"><button type="button" class="clear" data-clear="phase">&times;</button></div>
  </div>
  <div class="field"><label for="f-agent">agent</label>
    <div class="field-row"><input id="f-agent" name="agent"><button type="button" class="clear" data-clear="agent">&times;</button></div>
  </div>
  <div class="field"><label for="f-product_id">product_id</label>
    <div class="field-row"><input id="f-product_id" name="product_id"><button type="button" class="clear" data-clear="product_id">&times;</button></div>
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
      <option value="desc">Newest first</option>
      <option value="asc">Oldest first</option>
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
</form>

<div id="status"></div>
<table id="events-table" style="display:none">
  <thead>
    <tr><th>Timestamp</th><th>Event</th><th>Session ID</th><th>Phase</th><th>Agent</th><th>Product</th></tr>
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

function readStateFromUrl() {
  const params = new URLSearchParams(location.search);
  const state = { page: 1, pageSize: 50, sort: 'desc', filters: {} };
  for (const key of FILTER_KEYS) {
    const v = params.get(key);
    if (v) state.filters[key] = v;
  }
  const page = parseInt(params.get('page') || '', 10);
  if (Number.isFinite(page) && page > 0) state.page = page;
  const pageSize = parseInt(params.get('pageSize') || '', 10);
  if (Number.isFinite(pageSize) && pageSize > 0) state.pageSize = pageSize;
  if (params.get('sort') === 'asc') state.sort = 'asc';
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
  history.replaceState(null, '', location.pathname + '?' + params.toString());
}

function applyStateToForm(state) {
  for (const key of FILTER_KEYS) {
    const el = document.getElementById('f-' + key);
    if (el) el.value = state.filters[key] || '';
  }
  document.getElementById('sort').value = state.sort;
  document.getElementById('pageSize').value = String(state.pageSize);
}

function readFormIntoFilters(state) {
  state.filters = {};
  for (const key of FILTER_KEYS) {
    const el = document.getElementById('f-' + key);
    const v = el && el.value.trim();
    if (v) state.filters[key] = v;
  }
  state.sort = document.getElementById('sort').value === 'asc' ? 'asc' : 'desc';
  state.pageSize = parseInt(document.getElementById('pageSize').value, 10) || 50;
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

async function refresh() {
  const statusEl = document.getElementById('status');
  const table = document.getElementById('events-table');
  const pager = document.getElementById('pager');

  writeStateToUrl(currentState);
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

applyStateToForm(currentState);
refresh();
</script>
</body>
</html>
`;
