// ai-fix.js — single-issue AI fix view (combined helpers + logic).

// ════════════════════════════════════════════════════════════════
// Shared helpers (inlined)
// ════════════════════════════════════════════════════════════════

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
function iconForTab(id) {
  if (id === 'dashboard')    return iconDashboard();
  if (id === 'rules-market') return iconGrid();
  if (id === 'chat')         return iconChat();
  return '';
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
        <div class="brand-logo" aria-hidden="true">${iconShield()}</div>
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
      <a class="rail-brand" href="index.html" aria-label="Checkit Codebase Doctor">${iconShield()}</a>
      <nav class="rail-tabs" aria-label="主标签">${tabHtml}</nav>
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
function loadReport() {
  try {
    const s = localStorage.getItem('checkit:last-report');
    if (!s) return null;
    return JSON.parse(s);
  } catch { return null; }
}

// ════════════════════════════════════════════════════════════════
// AI fix page
// ════════════════════════════════════════════════════════════════

const params = new URLSearchParams(location.search);
const idx = parseInt(params.get('idx') ?? '-1', 10);
const sourceFile = params.get('file');

const cached = loadReport();
const issue = cached?.raw && idx >= 0 ? (
  Array.isArray(cached.raw) ? cached.raw[idx] : cached.raw.issues?.[idx]
) : null;

document.getElementById('app').insertAdjacentHTML('afterbegin', renderShell('dashboard'));
wireThemeToggle();
document.getElementById('brand-repo').textContent = sourceFile || cached?.filename || 'no project loaded';

const main = document.getElementById('main');

if (!issue) {
  main.innerHTML = `
    <div class="placeholder">
      <div class="placeholder-card">
        <h2>找不到这个问题</h2>
        <p>报告已经更新或 idx 失效。<br>回到主控台重新选择一条 issue。</p>
        <a class="btn btn-primary" href="index.html">回到主控台</a>
      </div>
    </div>`;
} else {
  renderFixPage(issue);
}

function renderFixPage(issue) {
  const plan = synthesizePlan(issue);
  const diff = synthesizePatch(issue);

  main.innerHTML = `
    <div class="ai-fix-page">
      <aside class="ai-fix-aside">
        <div class="detail-section" style="margin-bottom: 16px;">
          <a href="index.html" style="font-size: 12px; color: var(--muted);">← 返回主控台</a>
        </div>
        <div class="detail-section" style="margin-bottom: 16px;">
          <h4>问题诊断</h4>
          <div style="font-size: 14px; font-weight: 500; color: var(--fg-strong); margin-bottom: 6px;">${escapeHtml(issue.issue)}</div>
          <div class="issue-meta">
            <span class="pill pill-${pillKind(issue.level)}">${pillLabel(issue.level)}</span>
            <code>${escapeHtml(issue.module || issue.type || '—')}</code>
          </div>
          ${issue.file ? `<div class="detail-code" style="margin-top: 8px;">${escapeHtml(issue.file)}${issue.line ? ':' + issue.line : ''}</div>` : ''}
        </div>
        ${issue.expect ? `<div class="detail-section" style="margin-bottom: 16px;"><h4>修复方案</h4><div class="detail-code">${escapeHtml(issue.expect)}</div></div>` : ''}
        <div class="detail-section" style="margin-bottom: 16px;">
          <h4>AI 计划</h4>
          <ol style="margin: 0; padding-left: 20px; color: var(--fg); font-size: 13px; line-height: 1.7;">
            ${plan.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
          </ol>
        </div>
        <div class="detail-section" style="margin-bottom: 16px;">
          <h4>影响估算</h4>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
            <div class="summary-cell"><div class="summary-label">变更范围</div><div class="summary-value">${diff.linesAdded + diff.linesRemoved} 行</div></div>
            <div class="summary-cell"><div class="summary-label">新增 / 删除</div><div class="summary-value" style="color: var(--success);">+${diff.linesAdded} <span style="color: var(--muted-2);">/</span> <span style="color: var(--danger);">−${diff.linesRemoved}</span></div></div>
            <div class="summary-cell"><div class="summary-label">调用点</div><div class="summary-value">${diff.callSites ?? 1}</div></div>
            <div class="summary-cell"><div class="summary-label">是否需重部署</div><div class="summary-value">${diff.needsRedeploy ? '是' : '否'}</div></div>
          </div>
        </div>
      </aside>
      <section class="ai-fix-main">
        <div class="patch-head">
          <div>
            <div class="patch-file">${escapeHtml(issue.file || '<no file>')}</div>
            <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">合成 diff · ${escapeHtml(issue.module || 'rule')}</div>
          </div>
          <div style="display: flex; gap: 16px; align-items: center;">
            <div class="patch-stats">
              <span class="add">+${diff.linesAdded}</span>
              <span class="del">−${diff.linesRemoved}</span>
            </div>
            <div class="patch-toggle">
              <button class="active" data-mode="unified">Unified</button>
              <button data-mode="split">Split</button>
            </div>
          </div>
        </div>
        <div id="diff-host" style="overflow: auto; flex: 1;"></div>
        <div class="ai-fix-footer">
          <button class="btn" type="button" id="copy-patch">复制 Patch</button>
          <button class="btn btn-ghost" type="button" id="reject">拒绝</button>
          <button class="btn btn-primary" type="button" id="accept">应用补丁</button>
        </div>
      </section>
    </div>`;

  const host = document.getElementById('diff-host');
  function render(mode) {
    host.innerHTML = renderDiff(diff, mode);
    document.querySelectorAll('.patch-toggle button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  }
  document.querySelectorAll('.patch-toggle button').forEach((btn) => {
    btn.addEventListener('click', () => render(btn.dataset.mode));
  });
  render('unified');

  document.getElementById('copy-patch').addEventListener('click', () => {
    navigator.clipboard.writeText(diff.raw).catch(() => alert('剪贴板不可用'));
    document.getElementById('copy-patch').textContent = '已复制 ✓';
  });
  document.getElementById('reject').addEventListener('click', () => {
    history.back();
  });
  document.getElementById('accept').addEventListener('click', () => {
    alert(`V2: 调用本机 AI agent 跑 \`checkit --ai-fix\`。当前只展示合成 diff,实际改文件由 CLI 端完成。`);
  });
}

function synthesizePlan(issue) {
  const steps = [];
  const e = issue.expect || '';
  if (/replace|替换/i.test(e)) steps.push('按 expect 字段描述的方式替换当前实现');
  if (/import|添加|引入/i.test(e)) steps.push('在文件顶部 import 必要的依赖');
  if (/delete|remove|删除|移除/i.test(e)) steps.push('删除违规代码');
  if (/rename|改名|重命名/i.test(e)) steps.push('重命名以满足命名约束');
  steps.push('跑 `pnpm exec checkit` 验证 issue 不再触发');
  steps.push('如未清空,继续运行 `pnpm exec checkit --fix` 应用自动修复');
  return steps.slice(0, 5);
}

function synthesizePatch(issue) {
  const file = issue.file || 'unknown';
  const line = issue.line ?? 1;
  const beforeLine = `// TODO: original code here (line ${line})`;
  const afterLines = (issue.expect || '// fixed').split(/\n+/).filter(Boolean);
  const afterBlock = afterLines.map((l) => '  ' + l).join('\n');
  const before = [beforeLine];
  const after  = afterBlock.split('\n');
  const lines = [];
  let ln = Math.max(1, line - 1);
  lines.push({ kind: 'hunk', text: `@@ -${ln},${before.length} +${ln},${after.length} @@` });
  lines.push({ kind: 'ctx',  ln: ln, text: `// ${issue.module || 'rule'} triggered` });
  for (const b of before) {
    lines.push({ kind: 'del', ln: ln, text: b });
    ln++;
  }
  for (const a of after) {
    lines.push({ kind: 'add', ln: ln, text: a });
    ln++;
  }
  const raw = [
    `--- a/${file}`,
    `+++ b/${file}`,
    `@@ -${Math.max(1, line - 1)},${before.length} +${Math.max(1, line - 1)},${after.length} @@`,
    ` // ${issue.module || 'rule'} triggered`,
    `-${beforeLine}`,
    ...after.map((l) => '+' + l),
  ].join('\n');
  return {
    file, linesAdded: after.length, linesRemoved: before.length,
    callSites: 1, needsRedeploy: issue.level === 'error',
    raw, lines,
  };
}

function renderDiff(diff, mode) {
  const rows = diff.lines.map((row) => {
    if (row.kind === 'hunk') return `<tr class="hunk"><td colspan="3">${escapeHtml(row.text)}</td></tr>`;
    if (row.kind === 'ctx')  return `<tr><td class="ln">${row.ln}</td><td class="sig"> </td><td class="code">${escapeHtml(row.text)}</td></tr>`;
    if (row.kind === 'add')  return `<tr class="diff-add"><td class="ln">${row.ln}</td><td class="sig">+</td><td class="code">${escapeHtml(row.text)}</td></tr>`;
    if (row.kind === 'del')  return `<tr class="diff-del"><td class="ln">${row.ln}</td><td class="sig">−</td><td class="code">${escapeHtml(row.text)}</td></tr>`;
    return '';
  }).join('');
  return `<table class="diff-table"><tbody>${rows}</tbody></table>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function pillKind(level) { return level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'accent'; }
function pillLabel(level) { return level === 'error' ? '严重' : level === 'warning' ? '警告' : '提示'; }