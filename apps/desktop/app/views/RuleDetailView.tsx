'use client';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchRuleBody, type RuleDoc } from '../lib/api';

const SEVERITY_PILL: Record<RuleDoc['severity'], string> = {
  error: 'pill pill-error',
  warning: 'pill pill-warn',
  info: 'pill pill-accent',
};
const SEVERITY_LABEL: Record<RuleDoc['severity'], string> = {
  error: '严重',
  warning: '警告',
  info: '提示',
};

export function RuleDetailView() {
  const { ruleId = '' } = useParams<{ ruleId: string }>();
  const navigate = useNavigate();
  const [body, setBody] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBody(null);
    setError(null);
    fetchRuleBody(ruleId).then(setBody).catch((e) => setError(e.message));
  }, [ruleId]);

  const html = body ? renderMd(body) : '';

  return (
    <div style={{ padding: '24px 32px', maxWidth: 880 }}>
      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => navigate('/rules')}
          style={{ background: 'transparent', border: 'none', padding: 0, font: 'inherit', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}
        >
          ← 回到规则市场
        </button>
      </div>

      <header style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, color: 'var(--fg-strong)' }}>
            {ruleId}
          </code>
          {body && <span className={SEVERITY_PILL[extractSeverity(body)]}>{SEVERITY_LABEL[extractSeverity(body)]}</span>}
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-strong)', margin: 0 }}>
          {body ? extractTitle(body) : '加载中…'}
        </h1>
      </header>

      {error && (
        <div style={{ padding: 16, background: 'var(--danger-soft)', color: 'var(--danger)', borderRadius: 'var(--r)' }}>
          加载失败: {error}
        </div>
      )}

      {body && (
        <article
          className="md-body"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 24 }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}

function extractSeverity(md: string): RuleDoc['severity'] {
  const m = md.match(/severity:\s*(\w+)/);
  const s = m?.[1] ?? 'warning';
  if (s === 'warn') return 'warning';
  if (s === 'error' || s === 'warning' || s === 'info') return s;
  return 'warning';
}

function extractTitle(md: string): string {
  const m = md.match(/title:\s*(.+)/);
  return m?.[1]?.trim() ?? '';
}

function renderMd(md: string): string {
  const body = md.replace(/^---[\s\S]*?---\n/, '');
  const lines = body.split('\n');
  const out: string[] = [];
  let inCode = false;
  let inList = false;

  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };

  for (const raw of lines) {
    const line = raw;
    if (line.startsWith('```')) {
      if (inCode) { out.push('</code></pre>'); inCode = false; }
      else { closeList(); out.push('<pre style="background: var(--surface-2); padding: 12px; border-radius: var(--r-sm); overflow-x: auto; font-size: 12px;"><code>'); inCode = true; }
      continue;
    }
    if (inCode) {
      out.push(escape(line) + '\n');
      continue;
    }
    if (line.startsWith('## ')) { closeList(); out.push(`<h3 style="margin: 16px 0 6px; font-size: 13px; font-weight: 600; color: var(--fg-strong); text-transform: uppercase; letter-spacing: 0.04em;">${escape(line.slice(3))}</h3>`); continue; }
    if (line.startsWith('# ')) { closeList(); out.push(`<h2 style="margin: 20px 0 8px; font-size: 16px; font-weight: 600;">${escape(line.slice(2))}</h2>`); continue; }
    if (line.startsWith('- ')) {
      if (!inList) { out.push('<ul style="margin: 8px 0; padding-left: 20px; color: var(--fg); line-height: 1.7;">'); inList = true; }
      out.push(`<li>${escape(line.slice(2))}</li>`);
      continue;
    }
    if (line.trim() === '') { closeList(); out.push('<br/>'); continue; }
    closeList();
    out.push(`<p style="margin: 8px 0; line-height: 1.7;">${escape(line)}</p>`);
  }
  closeList();
  if (inCode) out.push('</code></pre>');
  return out.join('\n');
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
