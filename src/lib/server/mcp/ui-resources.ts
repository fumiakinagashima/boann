/**
 * MCP Apps（SEP-1865）用の ui:// リソース本体。list_<table>/get_<table> の結果を
 * チャット内にインラインでテーブル/詳細表示するための、テーブルに依存しない共通テンプレート。
 * 自己完結（インラインCSS/JS、外部リソースへの通信なし）。
 */

export const RECORD_VIEW_URI = 'ui://boann/record-view';

export const RECORD_VIEW_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  :root {
    color-scheme: light dark;
    --fg: #1a1a1a;
    --bg: #ffffff;
    --border: #e2e2e2;
    --muted: #767676;
    --head-bg: #f5f5f5;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --fg: #e6e6e6;
      --bg: #1e1e1e;
      --border: #3a3a3a;
      --muted: #9a9a9a;
      --head-bg: #2a2a2a;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 12px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13px;
    color: var(--fg);
    background: var(--bg);
  }
  table { width: 100%; border-collapse: collapse; }
  th, td {
    text-align: left;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 240px;
  }
  th { background: var(--head-bg); color: var(--muted); font-weight: 600; }
  dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; }
  dt { color: var(--muted); }
  dd { margin: 0; }
  .empty, .loading { color: var(--muted); padding: 8px 0; }
  pre { white-space: pre-wrap; word-break: break-all; margin: 0; }
</style>
</head>
<body>
<div id="root"><p class="loading">読み込み中…</p></div>
<script>
(function () {
  var root = document.getElementById('root');
  var nextId = 1;
  var pending = {};

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data) return;
    if (data.id !== undefined && pending[data.id]) {
      var cb = pending[data.id];
      delete pending[data.id];
      if (data.error) cb.reject(data.error); else cb.resolve(data.result);
      return;
    }
    if (data.method === 'ui/notifications/tool-result') {
      render(data.params || {});
    }
  });

  function sendRequest(method, params) {
    var id = nextId++;
    return new Promise(function (resolve, reject) {
      pending[id] = { resolve: resolve, reject: reject };
      window.parent.postMessage({ jsonrpc: '2.0', id: id, method: method, params: params }, '*');
    });
  }

  function escapeText(v) {
    var span = document.createElement('span');
    span.textContent = v === null || v === undefined ? '' : String(v);
    return span;
  }

  var SYSTEM_KEYS = ['createdAt', 'updatedAt', 'createdBy', 'updatedBy'];

  function orderedKeys(obj) {
    var keys = Object.keys(obj).filter(function (k) { return k !== 'id' && SYSTEM_KEYS.indexOf(k) === -1; });
    var out = [];
    if ('id' in obj) out.push('id');
    out = out.concat(keys);
    SYSTEM_KEYS.forEach(function (k) { if (k in obj) out.push(k); });
    return out;
  }

  function renderTable(rows) {
    if (rows.length === 0) {
      root.innerHTML = '';
      root.appendChild(Object.assign(document.createElement('p'), { className: 'empty', textContent: '該当するレコードがありません。' }));
      return;
    }
    var keys = orderedKeys(rows[0]);
    var table = document.createElement('table');
    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    keys.forEach(function (k) {
      var th = document.createElement('th');
      th.textContent = k;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      keys.forEach(function (k) {
        var td = document.createElement('td');
        td.title = row[k] === null || row[k] === undefined ? '' : String(row[k]);
        td.appendChild(escapeText(row[k]));
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    root.innerHTML = '';
    root.appendChild(table);
  }

  function renderDetail(obj) {
    var keys = orderedKeys(obj);
    var dl = document.createElement('dl');
    keys.forEach(function (k) {
      var dt = document.createElement('dt');
      dt.textContent = k;
      var dd = document.createElement('dd');
      dd.appendChild(escapeText(obj[k]));
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
    root.innerHTML = '';
    root.appendChild(dl);
  }

  function render(params) {
    var data = params.structuredContent;
    if (data === undefined) {
      var text = (params.content && params.content[0] && params.content[0].text) || '';
      root.innerHTML = '';
      var pre = document.createElement('pre');
      pre.textContent = text;
      root.appendChild(pre);
      return;
    }
    if (data && Array.isArray(data.records)) renderTable(data.records); else renderDetail(data || {});
  }

  sendRequest('ui/initialize', {
    protocolVersion: '2026-01-26',
    clientInfo: { name: 'boann-record-view', version: '0.1.0' },
    capabilities: {},
    appCapabilities: { availableDisplayModes: ['inline'] }
  }).catch(function () { /* ホスト情報取得はベストエフォート。失敗しても描画は続行する */ });
})();
</script>
</body>
</html>
`;
