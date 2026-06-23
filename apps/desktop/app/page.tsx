'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Shell, LoadingOverlay } from './components/Shell';
import { CATEGORIES, type Issue, type CategoryKey, categorizeIssue, computeHealth, groupBy, normalizeReport } from './lib/report';

const STORAGE_KEY = 'checkit:last-report';

export default function HomePage() {
  const [report, setReport] = useState<{ issues: Issue[]; source: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanCwd, setScanCwd] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('all');
  const [selectedLevel, setSelectedLevel] = useState<'all' | Issue['level']>('all');
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);

  // Restore last report from localStorage on mount
  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) {
        const cached = JSON.parse(s);
        setReport({ issues: cached.issues, source: cached.source });
      }
    } catch {}
  }, []);

  const persist = useCallback((r: { issues: Issue[]; source: string }) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)); } catch {}
  }, []);

  // Real CLI scan via Electron IPC
  const runScan = useCallback(async (cwd?: string, aiFix = false) => {
    if (typeof window === 'undefined' || !window.checkit) {
      alert('Electron bridge not available. Are you running outside Electron?');
      return;
    }
    setLoading(true);
    try {
      const result = await window.checkit.scan({ cwd, aiFix });
      if (result.ok && result.issues) {
        const source = cwd || 'scan';
        const r = { issues: result.issues, source };
        setReport(r);
        persist(r);
        setSelectedIdx(-1);
      } else {
        const reason = result.parseError || result.stderr || `exit ${result.exitCode}`;
        alert(`扫描失败: ${reason}`);
      }
    } catch (e: any) {
      alert(`扫描出错: ${e.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }, [persist]);

  const pickFolder = useCallback(async () => {
    if (typeof window === 'undefined' || !window.checkit) return;
    const folder = await window.checkit.pickFolder();
    if (folder) {
      setScanCwd(folder);
      runScan(folder, false);
    }
  }, [runScan]);

  const pickJson = useCallback(async () => {
    if (typeof window === 'undefined' || !window.checkit) return;
    const result = await window.checkit.pickJson();
    if (!result) return;
    if ('error' in result) { alert(result.error); return; }
    const r = normalizeReport(result.data, result.name);
    setReport(r);
    persist(r);
    setSelectedIdx(-1);
  }, [persist]);

  const isElectron = typeof window !== 'undefined' && !!window.checkit;

  // ── Empty state: pick project / file
  if (!report) {
    return (
      <Shell>
        <section className="dropzone">
          <div className="dropzone-inner">
            <div style={{ color: 'var(--muted)', marginBottom: 12 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="m17 8-5-5-5 5" />
                <path d="M12 3v12" />
              </svg>
            </div>
            <h2>选择一个项目</h2>
            <p>
              {isElectron
                ? '让 checkit 扫描一个目录,或导入之前的 JSON 报告。'
                : '当前不在 Electron 中运行 —— 用 file:// 直接打开的话只能拖入 JSON 报告。'}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" type="button" onClick={pickFolder} disabled={!isElectron}>
                选择项目目录
              </button>
              <button className="btn" type="button" onClick={pickJson}>
                导入 JSON 报告
              </button>
            </div>
            {scanCwd && (
              <p style={{ marginTop: 16, fontSize: 12, color: 'var(--muted)' }}>
                当前扫描: <code>{scanCwd}</code>
              </p>
            )}
          </div>
        </section>
        {loading && <LoadingOverlay text="Scanning…" />}
      </Shell>
    );
  }

  // ── Loaded state: 3-pane dashboard
  const { issues, source } = report;
  const score = computeHealth(issues);
  const errors   = issues.filter((i) => i.level === 'error').length;
  const warnings = issues.filter((i) => i.level === 'warning').length;
  const infos    = issues.filter((i) => i.level === 'info').length;
  const files    = new Set(issues.map((i) => i.file).filter(Boolean)).size;
  const fixable  = issues.filter((i) => i.fixable).length;

  const counts = groupBy(issues, (i) => categorizeIssue(i));
  const categoryEntries: Array<[CategoryKey, number]> = [
    ['all', issues.length],
    ...(Object.keys(CATEGORIES) as CategoryKey[])
      .filter((k) => k !== 'all')
      .map((k) => [k, counts.get(k)?.length ?? 0] as [CategoryKey, number])
      .filter(([, n]) => n > 0),
  ];

  const filteredIssues = issues
    .map((i, idx) => ({ i, idx }))
    .filter(({ i }) => selectedCategory === 'all' || categorizeIssue(i) === selectedCategory)
    .filter(({ i }) => selectedLevel === 'all' || i.level === selectedLevel);

  const selectedIssue = selectedIdx >= 0 ? issues[selectedIdx] : null;

  return (
    <Shell repo={source}>
      <section className="dash">
        <aside className="side-rail">
          <div className="side-eyebrow">体检项目</div>
          <nav className="cat-list">
            {categoryEntries.map(([k, n]) => (
              <button
                key={k}
                className={`cat-btn ${selectedCategory === k ? 'active' : ''}`}
                onClick={() => { setSelectedCategory(k); setSelectedIdx(-1); }}
              >
                <span>{CATEGORIES[k]}</span>
                <span className="count">{n}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="dash-main">
          <div className="scan-summary">
            <div className="score-ring">
              <svg viewBox="0 0 100 100">
                <circle className="track" cx="50" cy="50" r="44" />
                <circle
                  className="bar"
                  cx="50" cy="50" r="44"
                  style={{
                    stroke: score >= 80 ? 'var(--success)' : score >= 50 ? 'var(--warn)' : 'var(--danger)',
                    strokeDasharray: 2 * Math.PI * 44,
                    strokeDashoffset: 2 * Math.PI * 44 * (1 - score / 100),
                  }}
                />
              </svg>
              <div className="value">
                <span>{score}</span>
                <small>健康度</small>
              </div>
            </div>
            <div className="summary-grid">
              <div className="summary-cell"><div className="summary-label">问题总数</div><div className="summary-value">{issues.length}</div></div>
              <div className="summary-cell"><div className="summary-label">严重 / 警告 / 提示</div><div className="summary-value">{errors} / {warnings} / {infos}</div></div>
              <div className="summary-cell"><div className="summary-label">涉及文件</div><div className="summary-value">{files}</div></div>
              <div className="summary-cell"><div className="summary-label">可自动修复</div><div className="summary-value">{fixable}</div></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              <button className="btn btn-primary" type="button" onClick={() => runScan(scanCwd ?? undefined, true)} disabled={!isElectron || fixable === 0}>
                一键 AI 修复 ({fixable})
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => { localStorage.removeItem(STORAGE_KEY); setReport(null); setSelectedIdx(-1); }}>
                换一个项目
              </button>
            </div>
          </div>

          <div className="issue-tabs">
            {(['all', 'error', 'warning', 'info'] as const).map((lv) => {
              const cnt = lv === 'all' ? issues.length : issues.filter((i) => i.level === lv).length;
              return (
                <button key={lv} className={`issue-tab ${selectedLevel === lv ? 'active' : ''}`} onClick={() => setSelectedLevel(lv)}>
                  {lv === 'all' ? '全部' : lv === 'error' ? '严重' : lv === 'warning' ? '警告' : '提示'} <span className="count">{cnt}</span>
                </button>
              );
            })}
          </div>

          <ul className="issue-list">
            {filteredIssues.length === 0 && (
              <li style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>当前过滤条件下没有问题。</li>
            )}
            {filteredIssues.map(({ i, idx }) => (
              <li key={idx} className={`issue-row ${selectedIdx === idx ? 'selected' : ''}`} onClick={() => setSelectedIdx(idx)}>
                <span className={`issue-bar ${i.level}`} />
                <div className="issue-body">
                  <div className="issue-title">{i.issue}</div>
                  <div className="issue-meta">
                    <span className={`pill pill-${pillKind(i.level)}`}>{pillLabel(i.level)}</span>
                    <code>{i.module || i.type || '—'}</code>
                    {i.file ? <><span>·</span><code>{i.file}{i.line ? ':' + i.line : ''}</code></> : <><span>·</span><span>项目级</span></>}
                  </div>
                </div>
                <span style={{ alignSelf: 'center', color: 'var(--muted-2)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <aside className="dash-right">
          {!selectedIssue ? (
            <div className="detail-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" /><path d="M12 8v4" /><path d="M12 16h.01" />
              </svg>
              <div>选择一个问题查看详情</div>
            </div>
          ) : (
            <div className="detail-card">
              <div className="detail-section">
                <h4>问题</h4>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg-strong)', marginBottom: 6 }}>{selectedIssue.issue}</div>
                <div className="issue-meta">
                  <span className={`pill pill-${pillKind(selectedIssue.level)}`}>{pillLabel(selectedIssue.level)}</span>
                  <code>{selectedIssue.module || selectedIssue.type || '—'}</code>
                </div>
              </div>
              {selectedIssue.file && (
                <div className="detail-section">
                  <h4>位置</h4>
                  <div className="detail-code">{selectedIssue.file}{selectedIssue.line ? ':' + selectedIssue.line : ''}</div>
                </div>
              )}
              {selectedIssue.expect && (
                <div className="detail-section">
                  <h4>修复建议</h4>
                  <div className="detail-code">{selectedIssue.expect}</div>
                </div>
              )}
              {selectedIssue.data && (
                <div className="detail-section">
                  <h4>附加数据</h4>
                  <div className="detail-code">{JSON.stringify(selectedIssue.data, null, 2)}</div>
                </div>
              )}
              <div className="detail-actions">
                {selectedIssue.fixable && (
                  <Link className="btn btn-primary" href={`/ai-fix?idx=${selectedIdx}&file=${encodeURIComponent(source)}`} style={{ textAlign: 'center' }}>
                    一键 AI 修复 →
                  </Link>
                )}
                <button className="btn" type="button" onClick={() => { ignoreIssue(selectedIdx, report, setReport, persist); setSelectedIdx(-1); }}>忽略</button>
                <button className="btn btn-ghost" type="button" onClick={() => alert('标记误报 (V2: 加入 .checkitignore)')}>标记误报</button>
              </div>
            </div>
          )}
        </aside>
      </section>
      {loading && <LoadingOverlay />}
    </Shell>
  );
}

function ignoreIssue(idx: number, report: { issues: Issue[]; source: string }, setReport: any, persist: any) {
  const next = { ...report, issues: report.issues.filter((_, i) => i !== idx) };
  setReport(next);
  persist(next);
}

function pillKind(level: Issue['level'])  { return level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'accent'; }
function pillLabel(level: Issue['level']) { return level === 'error' ? '严重' : level === 'warning' ? '警告' : '提示'; }