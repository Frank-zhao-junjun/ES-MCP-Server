let fieldLabels = {};

const menuList = document.getElementById('menuList');
const selectedScenario = document.getElementById('selectedScenario');
const refreshBtn = document.getElementById('refreshBtn');
const scanBtn = document.getElementById('scanBtn');
const meta = document.getElementById('meta');
const objectHits = document.getElementById('objectHits');
const filterInput = document.getElementById('filterInput');
const objectTabs = document.getElementById('objectTabs');
const dataArea = document.getElementById('dataArea');
const kpiStrip = document.getElementById('kpiStrip');

let scenarios = [];
let activeKey = '';
let lastPayload = null;
let activeObjectIndex = 0;
let statusByScenarioKey = new Map();
let currentLoadAbort = null;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatAsDate(dt) {
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function formatAsDateTime(dt) {
  return `${formatAsDate(dt)} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}:${pad2(dt.getSeconds())}`;
}

function toReadableValue(columnName, value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value !== 'string') {
    return String(value);
  }

  const sapDateMatch = value.match(/^\/Date\((\d+)([+-]\d+)?\)\/$/);
  if (sapDateMatch) {
    const ms = Number(sapDateMatch[1]);
    const dt = new Date(ms);
    const isDateOnly = /Date$/i.test(columnName) && !/DateTime/i.test(columnName);
    return isDateOnly ? formatAsDate(dt) : formatAsDateTime(dt);
  }

  return value;
}

function renderMenu() {
  menuList.innerHTML = '';
  scenarios.forEach((ep) => {
    const s = statusByScenarioKey.get(ep.key);
    const statusClass = s ? s.status : 'unknown';
    const statusText = s ? s.status.toUpperCase() : 'N/A';
    const btn = document.createElement('button');
    btn.className = `menu-item ${ep.key === activeKey ? 'active' : ''}`;

    const menuHead = document.createElement('div');
    menuHead.className = 'menu-head';

    const codeSpan = document.createElement('span');
    codeSpan.className = 'menu-code';
    codeSpan.textContent = ep.code;

    const statusSpan = document.createElement('span');
    statusSpan.className = `menu-status ${statusClass}`;
    statusSpan.textContent = statusText;

    menuHead.appendChild(codeSpan);
    menuHead.appendChild(statusSpan);

    const labelSpan = document.createElement('span');
    labelSpan.className = 'menu-label';
    labelSpan.textContent = ep.title;

    btn.appendChild(menuHead);
    btn.appendChild(labelSpan);

    btn.addEventListener('click', () => {
      activeKey = ep.key;
      renderMenu();
      loadData();
    });
    menuList.appendChild(btn);
  });
}

function createTableSection(title, rows) {
  const section = document.createElement('section');
  const t = document.createElement('div');
  t.className = 'section-title';
  t.textContent = title;
  section.appendChild(t);

  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');
  table.appendChild(thead);
  table.appendChild(tbody);
  wrap.appendChild(table);
  section.appendChild(wrap);

  thead.innerHTML = '';
  tbody.innerHTML = '';

  if (!rows.length) {
    thead.innerHTML = '<tr><th>无数据</th></tr>';
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>当前查询未返回记录</td>';
    tbody.appendChild(tr);
    return section;
  }

  const columns = Object.keys(rows[0]).filter((k) => !k.startsWith('__') && !k.startsWith('@odata.'));
  const trHead = document.createElement('tr');
  columns.forEach((c) => {
    const th = document.createElement('th');
    const zhLabel = fieldLabels[c] || c;
    th.textContent = `${zhLabel} (${c})`;
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    columns.forEach((c) => {
      const td = document.createElement('td');
      const val = row[c];
      td.textContent = toReadableValue(c, val);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  return section;
}

function renderDataByMode(payload) {
  objectTabs.innerHTML = '';
  dataArea.innerHTML = '';

  const objects = payload.objects || [];
  if (!objects.length) {
    dataArea.appendChild(createTableSection('结果', []));
    return;
  }

  if (payload.viewMode === 'masterDetail') {
    const header = objects.find((o) => o.entityName === payload.headerEntity) || objects[0];
    const child = objects.find((o) => o.entityName === payload.childEntity) || objects[1] || objects[0];
    dataArea.appendChild(createTableSection(`主表：${header.entityName}`, header.rows || []));
    dataArea.appendChild(createTableSection(`子表：${child.entityName}`, child.rows || []));
    return;
  }

  if (payload.viewMode === 'tabs' && objects.length > 1) {
    objects.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = `obj-tab ${i === activeObjectIndex ? 'active' : ''}`;
      b.textContent = `${o.entityName} (${o.count})`;
      b.addEventListener('click', () => {
        activeObjectIndex = i;
        renderDataByMode(payload);
      });
      objectTabs.appendChild(b);
    });
    const selected = objects[activeObjectIndex] || objects[0];
    dataArea.appendChild(createTableSection(selected.entityName, selected.rows || []));
    return;
  }

  const one = objects[0];
  dataArea.appendChild(createTableSection(one.entityName, one.rows || []));
}

function renderObjectSummary(summary) {
  objectHits.innerHTML = '';
  if (!summary || !summary.length) {
    return;
  }

  summary.forEach((s) => {
    const chip = document.createElement('span');
    chip.className = 'hit-chip';
    chip.textContent = `${s.entityName}=${s.count}`;
    objectHits.appendChild(chip);
  });
}

function renderKpis(payload) {
  kpiStrip.innerHTML = '';
  if (!payload) return;

  const chips = [
    `总场景 ${payload.total}`,
    `可用 ${payload.green}`,
    `空结果 ${payload.yellow}`,
    `失败 ${payload.red}`,
  ];

  chips.forEach((text) => {
    const c = document.createElement('span');
    c.className = 'kpi-chip';
    c.textContent = text;
    kpiStrip.appendChild(c);
  });
}

function resetDataArea() {
  dataArea.innerHTML = '';
  objectTabs.innerHTML = '';
  objectHits.innerHTML = '';
  dataArea.appendChild(createTableSection('结果', []));
}

async function loadData() {
  if (!activeKey) {
    meta.textContent = '未选择场景';
    resetDataArea();
    return;
  }

  const s = scenarios.find((x) => x.key === activeKey);
  if (s) {
    selectedScenario.textContent = `${s.code} - ${s.title}`;
  }

  meta.textContent = `查询中: ${activeKey} ...`;
  const filter = filterInput.value.trim();
  const url = filter
    ? `/api/scenario/${encodeURIComponent(activeKey)}?filter=${encodeURIComponent(filter)}`
    : `/api/scenario/${encodeURIComponent(activeKey)}`;

  if (currentLoadAbort) {
    currentLoadAbort.abort();
  }
  currentLoadAbort = new AbortController();

  try {
    const resp = await fetch(url, { signal: currentLoadAbort.signal });
    const payload = await resp.json();
    if (!resp.ok) {
      meta.textContent = `查询失败: ${payload.error || resp.statusText} (${payload.detail || ''})`;
      lastPayload = null;
      activeObjectIndex = 0;
      resetDataArea();
      return;
    }

    lastPayload = payload;
    activeObjectIndex = 0;
    renderDataByMode(payload);
    renderObjectSummary(payload.objectSummary || []);
    meta.textContent = `场景: ${payload.scenario.code} | 对象数: ${(payload.objects || []).length} | 记录数: ${payload.count} | 时间: ${payload.fetchedAt}`;
  } catch (err) {
    if (err.name === 'AbortError') {
      return;
    }
    meta.textContent = `网络错误: ${err.message}`;
    lastPayload = null;
    activeObjectIndex = 0;
    resetDataArea();
  }
}

async function runStatusScan() {
  const resp = await fetch('/api/status-board');
  if (!resp.ok) {
    const payload = await resp.json().catch(() => ({}));
    throw new Error(payload.error || resp.statusText);
  }
  const payload = await resp.json();
  statusByScenarioKey = new Map((payload.rows || []).map((r) => [r.key, r]));
  renderKpis(payload);
  renderMenu();
}

async function loadFieldLabels() {
  try {
    const resp = await fetch('/api/field-labels');
    if (resp.ok) {
      fieldLabels = await resp.json();
    }
  } catch (_) {
    // 静默失败，使用默认空对象
  }
}

async function loadScenarios() {
  const resp = await fetch('/api/scenarios');
  if (!resp.ok) {
    const payload = await resp.json().catch(() => ({}));
    throw new Error(payload.error || resp.statusText);
  }
  const payload = await resp.json();
  scenarios = payload.scenarios || [];
  if (!scenarios.length) {
    meta.textContent = '未发现接口地址文件';
    return;
  }

  activeKey = scenarios[0].key;
  renderMenu();
  await runStatusScan();
  loadData();
}

refreshBtn.addEventListener('click', loadData);
scanBtn.addEventListener('click', async () => {
  meta.textContent = '巡检中...';
  try {
    await runStatusScan();
    meta.textContent = '巡检完成，左侧菜单状态已更新';
  } catch (err) {
    meta.textContent = `巡检失败: ${err.message}`;
  }
});

loadFieldLabels().then(() => loadScenarios()).catch((err) => {
  meta.textContent = `场景加载失败: ${err.message}`;
});
