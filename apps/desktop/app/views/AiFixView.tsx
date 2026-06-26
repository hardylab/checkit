'use client';
import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Issue } from '../lib/report';

const STORAGE_KEY = 'checkit:last-report';

export function AiFixView() {
  const { file = '', idx: idxParam = '0' } = useParams<{ file: string; idx: string }>();
  const idx = Number(idxParam) || 0;
  const navigate = useNavigate();
  const [report] = useState<{ issues: Issue[]; source: string } | null>(() => {
    try {
      const s = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (s) return JSON.parse(s);
    } catch {}
    return null;
  });

  const issue = report && idx >= 0 ? report.issues[idx] : null;
  const plan = useMemo(() => issue ? synthesizePlan(issue) : [], [issue]);
  const diff = useMemo(() => issue ? synthesizePatch(issue) : null, [issue]);
  const [mode, setMode] = useState<'unified' | 'split'>('unified');
  const [applying, setApplying] = useState(false);

  if (!issue || !diff) {
    return (
      <div className="placeholder">
        <div className="placeholder-card">
          <h2>找不到这个问题</h2>
          <p>报告已经更新或 idx 失效。<br />回到主控台重新选择一条 issue。</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>回到主控台</button>
        </div>
      </div>
    );
  }

  const onAccept = async () => {
    if (typeof window === 'undefined' || !window.checkit) return;
    setApplying(true);
    try {
      const result = await window.checkit.scan({ cwd: report?.source, aiFix: true });
      if (result.ok) alert('AI-Fix 已执行。重新扫描查看效果。');
      else alert(`AI-Fix 失败: ${result.stderr ?? result.parseError ?? `exit ${result.exitCode}`}`);
    } catch (e: any) {
      alert(`AI-Fix 出错: ${e.message ?? e}`);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="ai-fix-page">
      <aside className="ai-fix-aside">
        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{ background: 'transparent', border: 'none', padding: 0, font: 'inherit', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}
          >← 返回主控台</button>
        </div>
          <div className="detail-section" style={{ marginBottom: 16 }}>
            <h4>问题诊断</h4>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg-strong)', marginBottom: 6 }}>{issue.issue}</div>
            <div className="issue-meta">
              <span className={`pill pill-${pillKind(issue.level)}`}>{pillLabel(issue.level)}</span>
              <code>{issue.module || issue.type || '—'}</code>
            </div>
            {issue.file && <div className="detail-code" style={{ marginTop: 8 }}>{issue.file}{issue.line ? ':' + issue.line : ''}</div>}
          </div>
          {issue.expect && (
            <div className="detail-section" style={{ marginBottom: 16 }}>
              <h4>修复方案</h4>
              <div className="detail-code">{issue.expect}</div>
            </div>
          )}
          <div className="detail-section" style={{ marginBottom: 16 }}>
            <h4>AI 计划</h4>
            <ol style={{ margin: 0, paddingLeft: 20, color: 'var(--fg)', fontSize: 13, lineHeight: 1.7 }}>
              {plan.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>
          <div className="detail-section" style={{ marginBottom: 16 }}>
            <h4>影响估算</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              <div className="summary-cell"><div className="summary-label">变更范围</div><div className="summary-value">{diff.linesAdded + diff.linesRemoved} 行</div></div>
              <div className="summary-cell"><div className="summary-label">新增 / 删除</div><div className="summary-value" style={{ color: 'var(--success)' }}>+{diff.linesAdded} <span style={{ color: 'var(--muted-2)' }}>/</span> <span style={{ color: 'var(--danger)' }}>−{diff.linesRemoved}</span></div></div>
              <div className="summary-cell"><div className="summary-label">调用点</div><div className="summary-value">{diff.callSites}</div></div>
              <div className="summary-cell"><div className="summary-label">是否需重部署</div><div className="summary-value">{diff.needsRedeploy ? '是' : '否'}</div></div>
            </div>
          </div>
        </aside>

        <section className="ai-fix-main">
          <div className="patch-head">
            <div>
              <div className="patch-file">{issue.file || '<no file>'}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>合成 diff · {issue.module || 'rule'}</div>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div className="patch-stats">
                <span className="add">+{diff.linesAdded}</span>
                <span className="del">−{diff.linesRemoved}</span>
              </div>
              <div className="patch-toggle">
                <button className={mode === 'unified' ? 'active' : ''} onClick={() => setMode('unified')}>Unified</button>
                <button className={mode === 'split'   ? 'active' : ''} onClick={() => setMode('split')}>Split</button>
              </div>
            </div>
          </div>
          <div style={{ overflow: 'auto', flex: 1 }}>
            <table className="diff-table"><tbody>{renderDiff(diff, mode)}</tbody></table>
          </div>
          <div className="ai-fix-footer">
            <button className="btn" type="button" onClick={() => { navigator.clipboard.writeText(diff.raw).catch(() => {}); }}>
              复制 Patch
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/')}>拒绝</button>
            <button className="btn btn-primary" type="button" onClick={onAccept} disabled={applying}>
              {applying ? '执行中…' : '应用补丁'}
            </button>
          </div>
        </section>
      </div>
  );
}

function synthesizePlan(issue: Issue): string[] {
  const steps: string[] = [];
  const e = issue.expect || '';
  if (/replace|替换/i.test(e)) steps.push('按 expect 字段描述的方式替换当前实现');
  if (/import|添加|引入/i.test(e)) steps.push('在文件顶部 import 必要的依赖');
  if (/delete|remove|删除|移除/i.test(e)) steps.push('删除违规代码');
  if (/rename|改名|重命名/i.test(e)) steps.push('重命名以满足命名约束');
  steps.push('跑 checkit 验证 issue 不再触发');
  steps.push('如未清空,继续运行 --fix 应用自动修复');
  return steps.slice(0, 5);
}

function synthesizePatch(issue: Issue) {
  const file = issue.file || 'unknown';
  const line = issue.line ?? 1;
  const beforeLine = `// TODO: original code here (line ${line})`;
  const afterLines = (issue.expect || '// fixed').split(/\n+/).filter(Boolean);
  const afterBlock = afterLines.map((l) => '  ' + l).join('\n');
  const before = [beforeLine];
  const after = afterBlock.split('\n');
  const lines: Array<{ kind: 'hunk'|'ctx'|'add'|'del'; ln?: number; text: string }> = [];
  let ln = Math.max(1, line - 1);
  lines.push({ kind: 'hunk', text: `@@ -${ln},${before.length} +${ln},${after.length} @@` });
  lines.push({ kind: 'ctx', ln, text: `// ${issue.module || 'rule'} triggered` });
  for (const b of before) { lines.push({ kind: 'del', ln, text: b }); ln++; }
  for (const a of after) { lines.push({ kind: 'add', ln, text: a }); ln++; }
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

function renderDiff(diff: any, mode: 'unified' | 'split'): React.ReactNode[] {
  const rows = diff.lines.map((row: any, i: number): React.ReactNode => {
    if (row.kind === 'hunk') return <tr key={i} className="hunk"><td colSpan={mode === 'split' ? 2 : 3}>{row.text}</td></tr>;
    if (mode === 'split') {
      return row.kind === 'add'
        ? <tr key={i} className="diff-add"><td className="ln" /><td className="code">{row.text}</td></tr>
        : <tr key={i} className="diff-del"><td className="ln" /><td className="code">{row.text}</td></tr>;
    }
    if (row.kind === 'ctx')  return <tr key={i}><td className="ln">{row.ln}</td><td className="sig"> </td><td className="code">{row.text}</td></tr>;
    if (row.kind === 'add')  return <tr key={i} className="diff-add"><td className="ln">{row.ln}</td><td className="sig">+</td><td className="code">{row.text}</td></tr>;
    if (row.kind === 'del')  return <tr key={i} className="diff-del"><td className="ln">{row.ln}</td><td className="sig">−</td><td className="code">{row.text}</td></tr>;
    return null;
  });
  return rows;
}

function pillKind(level: Issue['level'])  { return level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'accent'; }
function pillLabel(level: Issue['level']) { return level === 'error' ? '严重' : level === 'warning' ? '警告' : '提示'; }
