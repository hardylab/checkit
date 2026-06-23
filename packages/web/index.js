// index.js — dashboard screen.
// Combines shared helpers (inlined at build time) + dashboard logic.
// Run: open packages/web/index.html in a browser.

// ════════════════════════════════════════════════════════════════
// app.js — shared helpers (inlined)
// ════════════════════════════════════════════════════════════════

function normalizeReport(raw) {
  const issues = Array.isArray(raw) ? raw : (raw?.issues ?? []);
  return { issues, raw };
}

function computeHealth(issues) {
  if (!issues.length) return 100;
  let penalty = 0;
  for (const i of issues) {
    if (i.level === 'error') penalty += 8;
    else if (i.level === 'warning') penalty += 3;
    else if (i.level === 'info') penalty += 1;
  }
  return Math.max(0, 100 - penalty);
}

function groupBy(issues, keyFn) {
  const out = new Map();
  for (const i of issues) {
    const k = keyFn(i);
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(i);
  }
  return out;
}

function categorizeIssue(issue) {
  const id = (issue.module || issue.type || '').toLowerCase();
  if (id.includes('secret') || id.includes('aws') || id.includes('credential') || id.includes('plaintext')) return 'security';
  if (id.includes('no-any') || id.includes('no-console') || id.includes('no-magic') || id.includes('function-size') || id.includes('many-conditions')) return 'quality';
  if (id.includes('spec') || id.includes('traceability')) return 'spec';
  if (id.includes('test')) return 'test';
  if (id.includes('flow') || id.includes('architecture')) return 'architecture';
  if (id.includes('git') || id.includes('ignore') || id.includes('utf8')) return 'repo';
  return 'other';
}

function wireDropzone(el, onFile) {
  const inner = el.querySelector('.dropzone-inner') || el;
  const fileInput = el.querySelector('input[type="file"]');

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        onFile(json, file.name);
      } catch (err) {
        alert(`Failed to parse ${file.name}: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  ['dragenter', 'dragover'].forEach((ev) => {
    inner.addEventListener(ev, (e) => {
      e.preventDefault();
      inner.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((ev) => {
    inner.addEventListener(ev, (e) => {
      e.preventDefault();
      inner.classList.remove('dragover');
    });
  });
  inner.addEventListener('drop', (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  });
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      handleFile(e.target.files[0]);
    });
  }
  inner.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    fileInput?.click();
  });
}

function renderShell(activeTab, opts = {}) {
  const tabs = [
    { id: 'dashboard',     href: 'index.html',         label: '主控台' },
    { id: 'rules-market',  href: 'rules-market.html',  label: '规则市场' },
    { id: 'chat',          href: 'chat.html',          label: 'Chat' },
  ];
  const tabHtml = tabs.map((t) => `
    <a class="rail-tab ${activeTab === t.id ? 'active' : ''}" href="${t.href}" title="${t.label}" aria-label="${t.label}">
      ${iconForTab(t.id)}
    </a>`).join('');

  return `
    <header class="topbar">
      <div class="brand">
        <div class="brand-logo" aria-hidden="true">
          ${iconShield()}
        </div>
        <div class="brand-text">
          <div class="brand-title">Checkit Codebase Doctor</div>
          <div class="brand-sub">
            <span class="branch-dot"></span>
            <span id="brand-repo">${opts.repo ?? 'no project loaded'}</span>
          </div>
        </div>
      </div>
      <div class="topbar-actions">
        <button class="btn btn-ghost" type="button">重新扫描</button>
        <button class="btn btn-ghost" type="button" id="theme-toggle" aria-label="切换主题">${iconSun()}</button>
      </div>
    </header>
    <aside class="rail" aria-label="主导航">
      <a class="rail-brand" href="index.html" aria-label="Checkit Codebase Doctor">
        ${iconShield()}
      </a>
      <nav class="rail-tabs" aria-label="主标签">
        ${tabHtml}
      </nav>
      <div class="rail-actions">
        <button class="rail-icon" type="button" aria-label="设置" title="设置">${iconSettings()}</button>
      </div>
    </aside>`;
}

function wireThemeToggle() {
  const stored = localStorage.getItem('checkit:theme');
  if (stored === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    if (next === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('checkit:theme', next);
  });
}

const STORAGE_KEY = 'checkit:last-report';
function saveReport(rawJson, filename) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ raw: rawJson, filename, at: Date.now() }));
  } catch {}
}
function loadReport() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return null;
    return JSON.parse(s);
  } catch { return null; }
}
function clearReport() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

function svg(path, opts = {}) {
  const size = opts.size ?? 18;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${opts.sw ?? 1.6}" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}
function iconShield()    { return svg('<path d="M12 2.5 4.5 5.5v6c0 5 3.2 9.4 7.5 10.5 4.3-1.1 7.5-5.5 7.5-10.5v-6L12 2.5Z"/><path d="m9 12 2 2 4-4"/>'); }
function iconDashboard() { return svg('<circle cx="12" cy="12" r="9"/><path d="M12 12 16 8"/><path d="M12 3v3 M12 18v3 M3 12h3 M18 12h3"/>'); }
function iconGrid()      { return svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'); }
function iconChat()      { return svg('<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>'); }
function iconSettings()  { return svg('<path d="M4 6h16M4 12h16M4 18h10"/>'); }
function iconSun()       { return svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>'); }
function iconArrowRight() { return svg('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'); }
function iconCheck()     { return svg('<path d="M20 6 9 17l-5-5"/>'); }
function iconCopy()      { return svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'); }
function iconX()         { return svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'); }
function iconForTab(id) {
  if (id === 'dashboard')    return iconDashboard();
  if (id === 'rules-market') return iconGrid();
  if (id === 'chat')         return iconChat();
  return '';
}

// ════════════════════════════════════════════════════════════════
// Dashboard logic
// ════════════════════════════════════════════════════════════════

const state = {
  raw: null, filename: null, issues: [],
  selectedCategory: 'all', selectedLevel: 'all', selectedIssueIdx: -1,
};

const els = {
  app: document.getElementById('app'),
  main: document.getElementById('main'),
  dropzone: document.getElementById('dropzone'),
  dashboard: document.getElementById('dashboard'),
  catList: document.getElementById('cat-list'),
  scoreBar: document.getElementById('score-bar'),
  scoreVal: document.getElementById('score-value'),
  total: document.getElementById('total-count'),
  sevCounts: document.getElementById('severity-counts'),
  filesCount: document.getElementById('files-count'),
  fixable: document.getElementById('fixable-count'),
  sevTabs: document.getElementById('severity-tabs'),
  issueList: document.getElementById('issue-list'),
  detail: document.getElementById('detail-panel'),
  brandRepo: null,
};

const CAT_LABELS = {
  all: '全部问题', security: '安全隐患', architecture: '架构与规范',
  quality: '代码质量', spec: '规范追踪', test: '测试覆盖',
  repo: '仓库卫生', other: '其他',
};

els.app.insertAdjacentHTML('afterbegin', renderShell('dashboard'));
wireThemeToggle();
els.brandRepo = document.getElementById('brand-repo');

const cached = loadReport();
if (cached?.raw) {
  loadIntoState(cached.raw, cached.filename);
} else {
  els.dropzone.hidden = false;
  wireDropzone(els.dropzone, (json, filename) => {
    saveReport(json, filename);
    loadIntoState(json, filename);
  });
  document.getElementById('pick-file')?.addEventListener('click', () => {
    els.dropzone.querySelector('input[type="file"]')?.click();
  });
}

document.getElementById('clear-report')?.addEventListener('click', () => {
  if (!confirm('清除当前报告?')) return;
  clearReport();
  location.reload();
});
document.getElementById('ai-fix-all')?.addEventListener('click', () => {
  alert('V2: 一键 AI 修复会调本地 agent 跑 `checkit --ai-fix`。先用 ai-fix.html 单条试。');
});

els.sevTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.issue-tab');
  if (!btn) return;
  [...els.sevTabs.querySelectorAll('.issue-tab')].forEach((b) => b.classList.toggle('active', b === btn));
  state.selectedLevel = btn.dataset.level;
  renderIssueList();
});

function loadIntoState(raw, filename) {
  const norm = normalizeReport(raw);
  state.raw = raw;
  state.filename = filename ?? 'report.json';
  state.issues = norm.issues;
  state.selectedIssueIdx = -1;
  els.dropzone.hidden = true;
  els.dashboard.hidden = false;
  if (els.brandRepo) els.brandRepo.textContent = state.filename;
  renderAll();
}

function renderAll() { renderScore(); renderSummary(); renderCategories(); renderIssueList(); renderDetail(); }

function renderScore() {
  const score = computeHealth(state.issues);
  els.scoreVal.textContent = score;
  const C = 2 * Math.PI * 44;
  const offset = C * (1 - score / 100);
  els.scoreBar.setAttribute('stroke-dasharray', C.toFixed(2));
  els.scoreBar.setAttribute('stroke-dashoffset', offset.toFixed(2));
  els.scoreBar.style.stroke = score >= 80 ? 'var(--success)' : score >= 50 ? 'var(--warn)' : 'var(--danger)';
}

function renderSummary() {
  const errs = state.issues.filter((i) => i.level === 'error').length;
  const warns = state.issues.filter((i) => i.level === 'warning').length;
  const infos = state.issues.filter((i) => i.level === 'info').length;
  const files = new Set(state.issues.map((i) => i.file).filter(Boolean)).size;
  const fix = state.issues.filter((i) => i.fixable).length;
  els.total.textContent = state.issues.length;
  els.sevCounts.textContent = `${errs} / ${warns} / ${infos}`;
  els.filesCount.textContent = files;
  els.fixable.textContent = fix;
  document.getElementById('cnt-all').textContent = state.issues.length;
  document.getElementById('cnt-error').textContent = errs;
  document.getElementById('cnt-warning').textContent = warns;
  document.getElementById('cnt-info').textContent = infos;
  document.getElementById('ai-fix-all').textContent = `一键 AI 修复 (${state.issues.filter((i)=>i.fixable).length})`;
}

function renderCategories() {
  const counts = groupBy(state.issues, (i) => categorizeIssue(i));
  const entries = [['all', state.issues.length], ...Object.entries(CAT_LABELS)
    .filter(([k]) => k !== 'all')
    .map(([k]) => [k, counts.get(k)?.length ?? 0])
    .filter(([, n]) => n > 0)];
  els.catList.innerHTML = entries.map(([k, n]) => `
    <button class="cat-btn ${state.selectedCategory === k ? 'active' : ''}" data-cat="${k}">
      <span>${CAT_LABELS[k] ?? k}</span>
      <span class="count">${n}</span>
    </button>`).join('');
  els.catList.querySelectorAll('.cat-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedCategory = btn.dataset.cat;
      state.selectedIssueIdx = -1;
      renderCategories(); renderIssueList(); renderDetail();
    });
  });
}

function renderIssueList() {
  const filtered = state.issues
    .map((i, idx) => ({ i, idx }))
    .filter(({ i }) => state.selectedCategory === 'all' || categorizeIssue(i) === state.selectedCategory)
    .filter(({ i }) => state.selectedLevel === 'all' || i.level === state.selectedLevel);

  if (!filtered.length) {
    els.issueList.innerHTML = `<li style="text-align:center; padding: 40px; color: var(--muted);">当前过滤条件下没有问题。</li>`;
    return;
  }

  els.issueList.innerHTML = filtered.map(({ i, idx }) => `
    <li class="issue-row ${state.selectedIssueIdx === idx ? 'selected' : ''}" data-idx="${idx}">
      <span class="issue-bar ${i.level}"></span>
      <div class="issue-body">
        <div class="issue-title">${escapeHtml(i.issue)}</div>
        <div class="issue-meta">
          <span class="pill pill-${pillKind(i.level)}">${pillLabel(i.level)}</span>
          <code>${escapeHtml(i.module || i.type || '—')}</code>
          ${i.file ? `<span>·</span><code>${escapeHtml(i.file)}${i.line ? ':' + i.line : ''}</code>` : '<span>·</span><span>项目级</span>'}
        </div>
      </div>
      <span style="align-self:center; color: var(--muted-2);">${iconArrowRight()}</span>
    </li>`).join('');

  els.issueList.querySelectorAll('.issue-row').forEach((row) => {
    row.addEventListener('click', () => {
      state.selectedIssueIdx = parseInt(row.dataset.idx, 10);
      renderIssueList(); renderDetail();
    });
  });
}

function renderDetail() {
  if (state.selectedIssueIdx < 0 || !state.issues[state.selectedIssueIdx]) {
    els.detail.innerHTML = `
      <div class="detail-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9"/>
          <path d="M12 8v4"/><path d="M12 16h.01"/>
        </svg>
        <div>选择一个问题查看详情</div>
      </div>`;
    return;
  }
  const issue = state.issues[state.selectedIssueIdx];
  const params = new URLSearchParams({ idx: String(state.selectedIssueIdx), file: state.filename });
  els.detail.innerHTML = `
    <div class="detail-card">
      <div class="detail-section">
        <h4>问题</h4>
        <div style="font-size: 14px; font-weight: 500; color: var(--fg-strong); margin-bottom: 6px;">${escapeHtml(issue.issue)}</div>
        <div class="issue-meta">
          <span class="pill pill-${pillKind(issue.level)}">${pillLabel(issue.level)}</span>
          <code>${escapeHtml(issue.module || issue.type || '—')}</code>
        </div>
      </div>
      ${issue.file ? `<div class="detail-section"><h4>位置</h4><div class="detail-code">${escapeHtml(issue.file)}${issue.line ? ':' + issue.line : ''}</div></div>` : ''}
      ${issue.expect ? `<div class="detail-section"><h4>修复建议</h4><div class="detail-code">${escapeHtml(issue.expect)}</div></div>` : ''}
      ${issue.data ? `<div class="detail-section"><h4>附加数据</h4><div class="detail-code">${escapeHtml(JSON.stringify(issue.data, null, 2))}</div></div>` : ''}
      <div class="detail-actions">
        ${issue.fixable ? `<a class="btn btn-primary" href="ai-fix.html?${params.toString()}" style="text-align:center;">一键 AI 修复 →</a>` : ''}
        <button class="btn" type="button" data-action="ignore">忽略</button>
        <button class="btn btn-ghost" type="button" data-action="false-positive">标记误报</button>
      </div>
    </div>`;
  els.detail.querySelector('[data-action="ignore"]')?.addEventListener('click', () => {
    state.issues.splice(state.selectedIssueIdx, 1);
    state.selectedIssueIdx = -1;
    renderAll();
  });
  els.detail.querySelector('[data-action="false-positive"]')?.addEventListener('click', () => {
    alert('标记误报 (V2: 加入 .checkitignore)');
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function pillKind(level) { return level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'accent'; }
function pillLabel(level) { return level === 'error' ? '严重' : level === 'warning' ? '警告' : '提示'; }