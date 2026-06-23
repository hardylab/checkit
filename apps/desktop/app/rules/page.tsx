'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '../components/Shell';
import { fetchRules, type RuleDoc } from '../lib/api';

const CATEGORY_LABEL: Record<string, string> = {
  ts: 'TypeScript',
  file: '文件 / Git',
  architecture: '架构 / 规范',
  'rule-self-check': '自检元规则',
  test: '测试',
};

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

const STATUS_LABEL: Record<RuleDoc['status'], string> = {
  stable: 'stable',
  draft: 'draft',
  experimental: 'experimental',
};

export default function RulesPage() {
  const [rules, setRules] = useState<RuleDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string>('all');
  const [activeSeverity, setActiveSeverity] = useState<'all' | RuleDoc['severity']>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchRules().then((d) => setRules(d.rules)).catch((e) => setError(e.message));
  }, []);

  const cats = Array.from(new Set(rules.map((r) => r.category))).sort();
  const filtered = rules
    .filter((r) => activeCat === 'all' || r.category === activeCat)
    .filter((r) => activeSeverity === 'all' || r.severity === activeSeverity)
    .filter((r) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return r.id.toLowerCase().includes(q) || r.title.toLowerCase().includes(q) || r.tags.some((t) => t.toLowerCase().includes(q));
    });

  return (
    <Shell repo="rules-market">
      <div style={{ padding: '24px 32px', maxWidth: 1400 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--fg-strong)', margin: 0 }}>规则市场</h1>
            <p style={{ color: 'var(--muted)', margin: '4px 0 0', fontSize: 13 }}>
              {error
                ? <span style={{ color: 'var(--danger)' }}>加载失败: {error}</span>
                : <>共 <strong style={{ color: 'var(--fg-strong)' }}>{rules.length}</strong> 条内置规则,从 <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>packages/backend/src/rules/</code> 实时读取</>}
            </p>
          </div>
          <input
            type="search"
            placeholder="搜索 id / title / tag…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r)',
              fontSize: 13,
              minWidth: 240,
              background: 'var(--surface)',
              color: 'var(--fg)',
            }}
          />
        </div>

        {/* Category filter */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <FilterBtn label={`全部 (${rules.length})`} active={activeCat === 'all'} onClick={() => setActiveCat('all')} />
          {cats.map((c) => {
            const n = rules.filter((r) => r.category === c).length;
            return (
              <FilterBtn
                key={c}
                label={`${CATEGORY_LABEL[c] ?? c} (${n})`}
                active={activeCat === c}
                onClick={() => setActiveCat(c)}
              />
            );
          })}
        </div>

        {/* Severity filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {(['all', 'error', 'warning', 'info'] as const).map((s) => (
            <FilterBtn
              key={s}
              label={s === 'all' ? '全部严重度' : SEVERITY_LABEL[s as RuleDoc['severity']]}
              active={activeSeverity === s}
              onClick={() => setActiveSeverity(s as any)}
            />
          ))}
        </div>

        {/* Rules grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
          {filtered.map((r) => (
            <RuleCard key={r.id} rule={r} />
          ))}
        </div>
        {filtered.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>没有匹配的规则。</div>
        )}
      </div>
    </Shell>
  );
}

function FilterBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={active ? 'issue-tab active' : 'issue-tab'}
      type="button"
      style={active ? { background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent)' } : {}}
    >
      {label}
    </button>
  );
}

function RuleCard({ rule }: { rule: RuleDoc }) {
  return (
    <Link
      href={`/rules/${encodeURIComponent(rule.id)}`}
      style={{
        display: 'block',
        padding: 16,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        textDecoration: 'none',
        color: 'var(--fg)',
        transition: 'all 0.15s var(--ease)',
      }}
      className="rule-card"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--fg-strong)' }}>
          {rule.id}
        </code>
        <span className={SEVERITY_PILL[rule.severity]}>{SEVERITY_LABEL[rule.severity]}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)', marginBottom: 8 }}>{rule.title}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 10 }}>
        {rule.tldr || <em style={{ opacity: 0.6 }}>暂无 TL;DR</em>}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        {rule.tags.slice(0, 4).map((t) => (
          <span key={t} className="pill">{t}</span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted-2)' }}>v{rule.since || '—'}</span>
      </div>
    </Link>
  );
}