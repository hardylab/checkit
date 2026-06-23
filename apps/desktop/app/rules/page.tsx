'use client';
import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Shell } from '../components/Shell';
import { fetchRules, fetchRuleBody, type RuleDoc } from '../lib/api';
import {
  RULE_SETS, CATEGORY_LABEL, isSetInstalled, fmtInstalls, freshnessLabel,
  type RuleSet, type RuleSetCategory,
} from '../lib/rule-sets';

type Tab = 'mine' | 'all';

const SOURCE_LABEL: Record<RuleSet['source'], string> = {
  official: '官方', community: '社区', team: '团队',
};

const SOURCE_PILL: Record<RuleSet['source'], string> = {
  official: 'pill pill-accent',
  community: 'pill',
  team: 'pill pill-warn',
};

const SEVERITY_PILL: Record<RuleDoc['severity'], string> = {
  error: 'pill pill-error', warning: 'pill pill-warn', info: 'pill pill-accent',
};
const SEVERITY_LABEL: Record<RuleDoc['severity'], string> = {
  error: '严重', warning: '警告', info: '提示',
};

type RuleConfig = { enabled: boolean; threshold: RuleDoc['severity']; globs: string[] };
const CONFIG_KEY = 'checkit:rule-config';
const INSTALLED_KEY = 'checkit:installed-rules';
const INSTALLED_SETS_KEY = 'checkit:installed-sets';
const DEFAULT_GLOBS = ['src/**/*.{ts,tsx}', 'app/**'];

export default function RulesPage() {
  const [tab, setTab] = useState<Tab>('all');
  const [activeCat, setActiveCat] = useState<RuleSetCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [installedRules, setInstalledRules] = useState<Set<string>>(new Set());
  const [installedSets, setInstalledSets] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Drawer state — points at a rule INSIDE a set
  const [drawerRule, setDrawerRule] = useState<RuleDoc | null>(null);
  const [drawerSet, setDrawerSet] = useState<RuleSet | null>(null);
  const [drawerBody, setDrawerBody] = useState<string | null>(null);
  const [drawerConfig, setDrawerConfig] = useState<RuleConfig | null>(null);
  const [configs, setConfigs] = useState<Record<string, RuleConfig>>({});
  const [allRules, setAllRules] = useState<RuleDoc[]>([]);

  useEffect(() => {
    fetchRules().then((d) => setAllRules(d.rules)).catch((e) => setError(e.message));
    try {
      const s = localStorage.getItem(CONFIG_KEY);
      if (s) setConfigs(JSON.parse(s));
      const ir = localStorage.getItem(INSTALLED_KEY);
      if (ir) { const a = JSON.parse(ir); if (Array.isArray(a)) setInstalledRules(new Set(a)); }
      const is = localStorage.getItem(INSTALLED_SETS_KEY);
      if (is) { const a = JSON.parse(is); if (Array.isArray(a)) setInstalledSets(new Set(a)); }
    } catch {}
  }, []);

  // Persist
  useEffect(() => {
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(configs)); } catch {}
  }, [configs]);
  useEffect(() => {
    try { localStorage.setItem(INSTALLED_KEY, JSON.stringify([...installedRules])); } catch {}
  }, [installedRules]);
  useEffect(() => {
    try { localStorage.setItem(INSTALLED_SETS_KEY, JSON.stringify([...installedSets])); } catch {}
  }, [installedSets]);

  // Filter sets
  const visibleSets = useMemo(() => {
    let s = RULE_SETS;
    if (tab === 'mine') s = s.filter((x) => installedSets.has(x.id));
    if (activeCat !== 'all') s = s.filter((x) => x.category === activeCat);
    if (query.trim()) {
      const q = query.toLowerCase();
      s = s.filter((x) =>
        x.name.toLowerCase().includes(q) ||
        x.id.toLowerCase().includes(q) ||
        x.description.toLowerCase().includes(q));
    }
    return s;
  }, [tab, activeCat, query, installedSets]);

  const installedCount = RULE_SETS.filter((s) => installedSets.has(s.id)).length;

  // Toggle whole set (install all / uninstall all)
  const toggleSet = (set: RuleSet, on: boolean) => {
    if (on) {
      setInstalledSets((prev) => new Set([...prev, set.id]));
      setInstalledRules((prev) => new Set([...prev, ...set.ruleIds]));
    } else {
      setInstalledSets((prev) => { const next = new Set(prev); next.delete(set.id); return next; });
      setInstalledRules((prev) => {
        const next = new Set(prev);
        for (const id of set.ruleIds) next.delete(id);
        return next;
      });
    }
  };

  // Drawer helpers
  const openRule = (rule: RuleDoc, parent: RuleSet) => {
    setDrawerRule(rule);
    setDrawerSet(parent);
    setDrawerConfig(configs[rule.id] ?? {
      enabled: true,
      threshold: rule.severity,
      globs: [...DEFAULT_GLOBS],
    });
    setDrawerBody(null);
    fetchRuleBody(rule.id).then(setDrawerBody).catch(() => setDrawerBody(null));
  };
  const closeDrawer = () => { setDrawerRule(null); setDrawerSet(null); };

  const saveConfig = () => {
    if (!drawerRule || !drawerSet) return;
    const enabledEl = document.querySelector<HTMLInputElement>('[data-testid="drawer-enabled"]');
    const finalEnabled = enabledEl ? enabledEl.checked : (drawerConfig?.enabled ?? true);
    const cfg: RuleConfig = drawerConfig
      ? { ...drawerConfig, enabled: finalEnabled }
      : { enabled: finalEnabled, threshold: drawerRule.severity, globs: [...DEFAULT_GLOBS] };
    setConfigs((c) => ({ ...c, [drawerRule.id]: cfg }));
    // sync to installed list
    setInstalledRules((prev) => {
      const next = new Set(prev);
      if (finalEnabled) next.add(drawerRule.id); else next.delete(drawerRule.id);
      return next;
    });
    closeDrawer();
  };
  const resetConfig = () => {
    if (!drawerRule) return;
    setDrawerConfig({ enabled: true, threshold: drawerRule.severity, globs: [...DEFAULT_GLOBS] });
  };
  const updateConfig = (patch: Partial<RuleConfig>) => {
    setDrawerConfig((c) => (c ? { ...c, ...patch } : c));
  };
  const addGlob = (g: string) => {
    const trimmed = g.trim();
    if (!trimmed || !drawerConfig) return;
    if (drawerConfig.globs.includes(trimmed)) return;
    updateConfig({ globs: [...drawerConfig.globs, trimmed] });
  };
  const removeGlob = (g: string) => {
    if (!drawerConfig) return;
    updateConfig({ globs: drawerConfig.globs.filter((x) => x !== g) });
  };

  const exampleCode = useMemo(() => {
    if (!drawerBody) return null;
    const m = drawerBody.match(/```[\w]*\n([\s\S]*?)\n```/);
    if (m) return m[1].trim();
    const when = drawerBody.match(/##\s*When it fires\s*\n+([\s\S]*?)(?:\n##|$)/);
    return when ? when[1].trim().slice(0, 200) : null;
  }, [drawerBody]);

  const cats = Array.from(new Set(RULE_SETS.map((s) => s.category))) as RuleSetCategory[];

  return (
    <Shell repo="rules-market">
      <div style={{ padding: '24px 32px', maxWidth: 1400 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--fg-strong)', margin: 0 }}>规则市场</h1>
            <p style={{ color: 'var(--muted)', margin: '4px 0 0', fontSize: 13 }}>
              {error ? <span style={{ color: 'var(--danger)' }}>加载失败: {error}</span> : (
                <>共 <strong style={{ color: 'var(--fg-strong)' }}>{RULE_SETS.length}</strong> 个 set / 涵盖 <strong style={{ color: 'var(--fg-strong)' }}>{new Set(RULE_SETS.flatMap((s) => s.ruleIds)).size}</strong> 条内置规则。每个 set 装一下就开启一组规则。</>
              )}
            </p>
          </div>
          <input
            type="search"
            placeholder="搜索 set / 描述…"
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

        {/* Tab: 我的规则 / 所有规则 */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
          <TabBtn label={`我的规则 (${installedCount})`} active={tab === 'mine'} onClick={() => setTab('mine')} />
          <TabBtn label={`所有规则 (${RULE_SETS.length})`} active={tab === 'all'} onClick={() => setTab('all')} />
        </div>

        {/* Category sidebar as filters */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
          <FilterBtn label={`全部分类 (${RULE_SETS.length})`} active={activeCat === 'all'} onClick={() => setActiveCat('all')} />
          {cats.map((c) => {
            const n = RULE_SETS.filter((s) => s.category === c).length;
            return (
              <FilterBtn
                key={c}
                label={`${CATEGORY_LABEL[c]} (${n})`}
                active={activeCat === c}
                onClick={() => setActiveCat(c)}
              />
            );
          })}
        </div>

        {/* Installed strip — only when on "all" tab and user has any */}
        {tab === 'all' && installedCount > 0 && (
          <div style={{
            display: 'flex',
            gap: 8,
            padding: '10px 12px',
            marginBottom: 20,
            background: 'var(--accent-soft)',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--r)',
            alignItems: 'center',
            fontSize: 13,
            color: 'var(--accent)',
          }} data-testid="installed-strip">
            <span style={{ fontWeight: 600 }}>已启用 {installedCount} 项</span>
            <span style={{ color: 'var(--accent)', opacity: 0.7 }}>·</span>
            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {RULE_SETS.filter((s) => installedSets.has(s.id)).slice(0, 6).map((s) => (
                <span key={s.id} style={{
                  padding: '2px 8px',
                  background: 'var(--surface)',
                  borderRadius: 'var(--r-pill)',
                  fontSize: 12,
                  color: 'var(--fg)',
                }}>{s.icon}</span>
              ))}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginLeft: 'auto', color: 'var(--accent)' }}
              onClick={() => setTab('mine')}
            >
              查看我的 →
            </button>
          </div>
        )}

        {/* Set grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }} data-testid="set-grid">
          {visibleSets.map((s) => {
            const installed = installedSets.has(s.id);
            const enabledInConfig = s.ruleIds.filter((id) => configs[id]?.enabled !== false).length;
            const allEnabled = enabledInConfig === s.ruleIds.length;
            return (
              <article
                key={s.id}
                data-set-card
                data-set-id={s.id}
                data-installed={installed ? 'true' : 'false'}
                style={{
                  padding: 16,
                  background: 'var(--surface)',
                  border: `1px solid ${installed ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-lg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  opacity: installed ? 1 : 0.85,
                }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div
                    aria-hidden
                    style={{
                      width: 40, height: 40,
                      borderRadius: 'var(--r)',
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      display: 'grid', placeItems: 'center',
                      fontWeight: 600, fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    {s.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-strong)', margin: 0 }}>{s.name}</h2>
                      {s.featured && <span className="pill pill-accent" style={{ fontSize: 10 }}>精选</span>}
                      <span className={SOURCE_PILL[s.source]} style={{ fontSize: 10 }}>{SOURCE_LABEL[s.source]}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted-2)', fontFamily: 'var(--font-mono)' }}>v{s.installs > 0 ? `0.${Math.max(1, Math.floor(s.installs / 1000))}` : '0'} · {freshnessLabel(s.updatedDays)}</div>
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{s.description}</p>

                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', fontSize: 11, color: 'var(--muted-2)' }}>
                  <span>{s.ruleIds.length} 条规则</span>
                  <span>·</span>
                  <span>{CATEGORY_LABEL[s.category]}</span>
                  {s.rating > 0 && (
                    <>
                      <span>·</span>
                      <span>★ {s.rating.toFixed(1)}</span>
                      <span>·</span>
                      <span>{fmtInstalls(s.installs)} 装</span>
                    </>
                  )}
                </div>

                {/* Rule list inside set */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                  {s.ruleIds.map((rid) => {
                    const r = allRules.find((x) => x.id === rid);
                    if (!r) {
                      return (
                        <span key={rid} className="pill" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.5 }} title="rule 不存在">{rid}</span>
                      );
                    }
                    return (
                      <button
                        key={rid}
                        type="button"
                        onClick={() => openRule(r, s)}
                        className={SEVERITY_PILL[r.severity]}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', border: 'none' }}
                        data-rule-pill
                        data-rule-id={rid}
                      >
                        {r.id}
                      </button>
                    );
                  })}
                </div>

                {/* Footer: install toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {installed ? `已启用 (${enabledInConfig}/${s.ruleIds.length} 条规则激活)` : '未启用'}
                  </span>
                  {installed ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ color: 'var(--danger)' }}
                      onClick={() => toggleSet(s, false)}
                      data-testid={`uninstall-${s.id}`}
                    >
                      停用
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => toggleSet(s, true)}
                      data-testid={`install-${s.id}`}
                    >
                      + 安装
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {visibleSets.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }} data-testid="empty">
            {tab === 'mine' ? '还没有装任何 set — 切到「所有规则」挑一个?' : '没有匹配的 set。'}
          </div>
        )}
      </div>

      {/* Drawer overlay + panel — same as before */}
      <div className={`drawer-overlay ${drawerRule ? 'open' : ''}`} onClick={closeDrawer} aria-hidden={!drawerRule} />
      <aside className={`drawer ${drawerRule ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label="规则配置">
        {drawerRule && drawerConfig && (
          <>
            <div className="drawer-head">
              <h3>
                {drawerSet && (
                  <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-sans)', fontWeight: 500, marginRight: 6 }}>
                    {drawerSet.name} /
                  </span>
                )}
                {drawerRule.id}
              </h3>
              <button className="drawer-close" type="button" onClick={closeDrawer} aria-label="关闭">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>
            <div className="drawer-body">
              <div className="drawer-hero">
                <div className="drawer-hero-icon">{drawerRule.id.slice(0, 2).toUpperCase()}</div>
                <div>
                  <div className="drawer-hero-title">{drawerRule.title}</div>
                  <div className="drawer-hero-meta">
                    <span className={SEVERITY_PILL[drawerRule.severity]} style={{ marginRight: 6 }}>{SEVERITY_LABEL[drawerRule.severity]}</span>
                    来自 <strong style={{ color: 'var(--fg-strong)' }}>{drawerSet?.name ?? 'checkit'}</strong>
                  </div>
                  <div className="drawer-hero-desc">{drawerRule.tldr}</div>
                </div>
              </div>

              <div className="drawer-section">
                <div className="drawer-toggle-row">
                  <span className="label">启用此规则</span>
                  <input
                    type="checkbox"
                    checked={drawerConfig.enabled}
                    onChange={(e) => updateConfig({ enabled: e.target.checked })}
                    style={{ width: 32, height: 18 }}
                    data-testid="drawer-enabled"
                  />
                </div>
                <p className="desc">关闭后该规则不会出现在扫描结果中。</p>
              </div>

              <div className="drawer-section">
                <h4>严重等级阈值</h4>
                <div className="drawer-segmented" role="tablist" aria-label="严重等级">
                  {(['error', 'warning', 'info'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="tab"
                      aria-selected={drawerConfig.threshold === s}
                      className={drawerConfig.threshold === s ? 'active' : ''}
                      onClick={() => updateConfig({ threshold: s })}
                    >
                      {SEVERITY_LABEL[s]}
                    </button>
                  ))}
                </div>
                <p className="desc">低于此等级的问题将不计入扫描统计。</p>
              </div>

              <div className="drawer-section">
                <h4>适用文件</h4>
                <div className="drawer-globs">
                  {drawerConfig.globs.map((g) => (
                    <span key={g} className="drawer-glob">
                      {g}
                      <button type="button" onClick={() => removeGlob(g)} aria-label={`移除 ${g}`}>×</button>
                    </span>
                  ))}
                  <button
                    type="button"
                    className="drawer-add-glob"
                    onClick={() => {
                      const next = window.prompt('添加 glob 表达式:');
                      if (next) addGlob(next);
                    }}
                  >
                    + 添加
                  </button>
                </div>
                <p className="desc">默认覆盖 src 与 app 目录。</p>
              </div>

              {exampleCode && (
                <div className="drawer-section">
                  <h4>触发示例</h4>
                  <pre className="drawer-code-block">{exampleCode}</pre>
                </div>
              )}
            </div>

            <div className="drawer-foot">
              <button type="button" className="btn btn-ghost" onClick={resetConfig}>重置默认</button>
              <button type="button" className="btn btn-primary" onClick={saveConfig} data-testid="drawer-save">保存配置</button>
            </div>
          </>
        )}
      </aside>
    </Shell>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        padding: '10px 16px',
        background: 'none',
        border: 'none',
        borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
        color: active ? 'var(--accent)' : 'var(--muted)',
        fontWeight: active ? 600 : 500,
        fontSize: 13,
        cursor: 'pointer',
        marginBottom: -1,
      }}
      data-testid={`tab-${active ? 'active' : 'inactive'}`}
    >
      {label}
    </button>
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