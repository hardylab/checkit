'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { Shell } from '../components/Shell';
import { fetchRules, fetchRuleBody, type RuleDoc } from '../lib/api';
import { useColumnLayout } from '../lib/use-column-layout';
import {
  RULE_SETS, CATEGORY_LABEL, isSetInstalled, fmtInstalls, freshnessLabel,
  type RuleSet, type RuleSetCategory,
} from '../lib/rule-sets';

type Scope = 'mine' | 'all';

const SOURCE_LABEL: Record<RuleSet['source'], string> = {
  official: '官方', community: '社区', team: '团队',
};

const SEVERITY_PILL: Record<RuleDoc['severity'], string> = {
  error: 'pill pill-error', warning: 'pill pill-warn', info: 'pill pill-accent',
};
const SEVERITY_LABEL: Record<RuleDoc['severity'], string> = {
  error: '严重', warning: '警告', info: '提示',
};

const RULE_CONFIG_KEY = 'checkit:rule-config';
const INSTALLED_RULES_KEY = 'checkit:installed-rules';
const INSTALLED_SETS_KEY = 'checkit:installed-sets';
const DEFAULT_GLOBS = ['src/**/*.{ts,tsx}', 'app/**'];

// Inline SVG icons matching the prototype's set icon family.
// Use createElement instead of JSX so a single key can hold multiple <path>/<rect> elements.
const e = React.createElement;
const ICONS: Record<string, React.ReactNode> = {
  盾: e('path', { d: 'M12 2.5 4.5 5.5v6c0 5 3.2 9.4 7.5 10.5 4.3-1.1 7.5-5.5 7.5-10.5v-6L12 2.5Z' }),
  TS: e('path', { d: 'M3 4h18v3h-7v13h-4V7H3V4Z' }),
  模: e(React.Fragment, null, e('rect', { x: '3', y: '3', width: '7', height: '7', rx: '1' }), e('rect', { x: '14', y: '3', width: '7', height: '7', rx: '1' }), e('rect', { x: '3', y: '14', width: '7', height: '7', rx: '1' }), e('rect', { x: '14', y: '14', width: '7', height: '7', rx: '1' })),
  文: e(React.Fragment, null, e('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }), e('path', { d: 'M14 2v6h6' }), e('path', { d: 'M8 13h8M8 17h6' })),
  测: e(React.Fragment, null, e('path', { d: 'M9 2v6L4 18a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-10V2' }), e('path', { d: 'M7 2h10' }), e('path', { d: 'M3 22h18' })),
  整: e('path', { d: 'M3 6h18M3 12h12M3 18h18' }),
  配: e(React.Fragment, null, e('circle', { cx: '12', cy: '12', r: '3' }), e('path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' })),
  档: e(React.Fragment, null, e('path', { d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20' }), e('path', { d: 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' })),
  流: e('path', { d: 'M2 12h6l3-9 4 18 3-9h4' }),
  鲜: e(React.Fragment, null, e('circle', { cx: '12', cy: '12', r: '9' }), e('path', { d: 'M12 7v5l3 2' })),
};

type RuleConfig = { enabled: boolean; threshold: RuleDoc['severity']; globs: string[] };

export default function RulesPage() {
  const [scope, setScope] = useState<Scope>('all');
  const [activeCat, setActiveCat] = useState<RuleSetCategory | null>(null);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [installedRules, setInstalledRules] = useState<Set<string>>(new Set());
  const [installedSets, setInstalledSets] = useState<Set<string>>(new Set());
  const [configs, setConfigs] = useState<Record<string, RuleConfig>>({});
  const [allRules, setAllRules] = useState<RuleDoc[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Drawer
  const [drawerRule, setDrawerRule] = useState<RuleDoc | null>(null);
  const [drawerSet, setDrawerSet] = useState<RuleSet | null>(null);
  const [drawerBody, setDrawerBody] = useState<string | null>(null);
  const [drawerConfig, setDrawerConfig] = useState<RuleConfig | null>(null);

  const [hydrated, setHydrated] = useState(false);

  // Resizable columns with localStorage persistence.
  const sideRail = useColumnLayout('side-rail', 240, { min: 160, max: 360, side: 'left' });
  const rulePane = useColumnLayout('rule-pane', 360, { min: 240, max: 560, side: 'right' });

  useEffect(() => {
    fetchRules().then((d) => setAllRules(d.rules)).catch((e) => setError(e.message));
    try {
      const s = localStorage.getItem(RULE_CONFIG_KEY);
      if (s) setConfigs(JSON.parse(s));
      const ir = localStorage.getItem(INSTALLED_RULES_KEY);
      if (ir) { const a = JSON.parse(ir); if (Array.isArray(a)) setInstalledRules(new Set(a)); }
      const is = localStorage.getItem(INSTALLED_SETS_KEY);
      if (is) { const a = JSON.parse(is); if (Array.isArray(a)) setInstalledSets(new Set(a)); }
    } catch {}
    // Mark hydrated AFTER the initial localStorage read so the persist
    // effects below don't immediately overwrite stored data with the
    // default empty state.
    setHydrated(true);
  }, []);

  // Persist — only AFTER hydration so we don't clobber stored state.
  useEffect(() => { if (hydrated) try { localStorage.setItem(RULE_CONFIG_KEY, JSON.stringify(configs)); } catch {} }, [configs, hydrated]);
  useEffect(() => { if (hydrated) try { localStorage.setItem(INSTALLED_RULES_KEY, JSON.stringify([...installedRules])); } catch {} }, [installedRules, hydrated]);
  useEffect(() => { if (hydrated) try { localStorage.setItem(INSTALLED_SETS_KEY, JSON.stringify([...installedSets])); } catch {} }, [installedSets, hydrated]);

  // Side-rail categories: built from RULE_SETS, with per-category counts in current scope
  const cats = useMemo(() => {
    const map = new Map<RuleSetCategory, number>();
    for (const s of RULE_SETS) {
      if (scope === 'mine' && !installedSets.has(s.id)) continue;
      map.set(s.category, (map.get(s.category) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [scope, installedSets]);

  // When the active category disappears (e.g. switch to mine and no installed sets in that cat), reset selection
  useEffect(() => {
    if (activeCat && !cats.find(([c]) => c === activeCat)) {
      setActiveCat(null);
      setSelectedSetId(null);
    }
  }, [activeCat, cats]);

  const setsInActiveCat = useMemo(() => {
    if (!activeCat) return [];
    return RULE_SETS.filter((s) => s.category === activeCat && (scope === 'all' || installedSets.has(s.id)));
  }, [activeCat, scope, installedSets]);

  const selectedSet = useMemo(
    () => setsInActiveCat.find((s) => s.id === selectedSetId) ?? null,
    [setsInActiveCat, selectedSetId]
  );

  // Drawer helpers
  const openRule = (rule: RuleDoc, parent: RuleSet) => {
    setDrawerRule(rule);
    setDrawerSet(parent);
    setDrawerConfig(configs[rule.id] ?? { enabled: true, threshold: rule.severity, globs: [...DEFAULT_GLOBS] });
    setDrawerBody(null);
    fetchRuleBody(rule.id).then(setDrawerBody).catch(() => setDrawerBody(null));
  };
  const closeDrawer = () => { setDrawerRule(null); setDrawerSet(null); };

  const saveConfig = () => {
    if (!drawerRule) return;
    const enabledEl = document.querySelector<HTMLInputElement>('[data-testid="drawer-enabled"]');
    const finalEnabled = enabledEl ? enabledEl.checked : (drawerConfig?.enabled ?? true);
    const cfg: RuleConfig = drawerConfig
      ? { ...drawerConfig, enabled: finalEnabled }
      : { enabled: finalEnabled, threshold: drawerRule.severity, globs: [...DEFAULT_GLOBS] };
    setConfigs((c) => ({ ...c, [drawerRule.id]: cfg }));
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
  const updateConfig = (patch: Partial<RuleConfig>) => setDrawerConfig((c) => (c ? { ...c, ...patch } : c));
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

  // Toggle a single rule (from rule-pane toggle button)
  const toggleRule = (ruleId: string, setId: string, on: boolean) => {
    setConfigs((c) => {
      const cur = c[ruleId] ?? { enabled: true, threshold: allRules.find((r) => r.id === ruleId)?.severity ?? 'warning', globs: [...DEFAULT_GLOBS] };
      return { ...c, [ruleId]: { ...cur, enabled: on } };
    });
    setInstalledRules((prev) => {
      const next = new Set(prev);
      if (on) next.add(ruleId); else next.delete(ruleId);
      return next;
    });
    // Track which sets have at least one enabled rule, so "我的规则" stays in sync
    setInstalledSets((prev) => {
      const set = RULE_SETS.find((s) => s.id === setId);
      if (!set) return prev;
      const allRuleEnabled = set.ruleIds.every((id) => {
        if (id === ruleId) return on;
        const cfg = configs[id];
        return cfg?.enabled !== false;
      });
      const next = new Set(prev);
      if (allRuleEnabled) next.add(setId); else next.delete(setId);
      return next;
    });
  };

  // Toggle a whole set
  const toggleSet = (set: RuleSet, on: boolean) => {
    if (on) {
      setInstalledSets((prev) => new Set([...prev, set.id]));
      setInstalledRules((prev) => new Set([...prev, ...set.ruleIds]));
      setConfigs((prev) => {
        const next = { ...prev };
        for (const id of set.ruleIds) {
          const cur = next[id] ?? { enabled: true, threshold: allRules.find((r) => r.id === id)?.severity ?? 'warning', globs: [...DEFAULT_GLOBS] };
          next[id] = { ...cur, enabled: true };
        }
        return next;
      });
    } else {
      setInstalledSets((prev) => { const n = new Set(prev); n.delete(set.id); return n; });
      setInstalledRules((prev) => {
        const n = new Set(prev);
        for (const id of set.ruleIds) n.delete(id);
        return n;
      });
      setConfigs((prev) => {
        const next = { ...prev };
        for (const id of set.ruleIds) {
          if (next[id]) next[id] = { ...next[id], enabled: false };
        }
        return next;
      });
    }
  };

  // Click scope tab: reset selection
  const onScopeChange = (s: Scope) => {
    setScope(s);
    setActiveCat(null);
    setSelectedSetId(null);
  };
  const onCatClick = (c: RuleSetCategory) => {
    if (activeCat === c) {
      setActiveCat(null);
      setSelectedSetId(null);
    } else {
      setActiveCat(c);
      setSelectedSetId(null);
    }
  };

  // For rule-pane: resolve rule objects for selected set
  const selectedSetRules = useMemo<RuleDoc[]>(() => {
    if (!selectedSet) return [];
    return selectedSet.ruleIds
      .map((id) => allRules.find((r) => r.id === id))
      .filter((r): r is RuleDoc => !!r);
  }, [selectedSet, allRules]);

  const installedCount = installedSets.size;

  return (
    <Shell repo="rules-market">
      <div className="rules-shell">
        {/* ── Side rail (VSCode sidebar) ─────────────────────────── */}
        <aside className="rules-side-rail" aria-label="规则分类导航" style={{ flex: `0 0 ${sideRail.width}px`, width: `${sideRail.width}px` }}>
          <div className="rules-side-eyebrow">规则市场</div>
          <div className="rules-side-tabs" role="tablist" aria-label="规则范围">
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'mine'}
              className={`rules-side-tab ${scope === 'mine' ? 'active' : ''}`}
              onClick={() => onScopeChange('mine')}
              data-testid="scope-mine"
            >
              我的规则
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'all'}
              className={`rules-side-tab ${scope === 'all' ? 'active' : ''}`}
              onClick={() => onScopeChange('all')}
              data-testid="scope-all"
            >
              所有规则
            </button>
          </div>

          <nav className="rules-cat-list" aria-label="规则分类">
            {cats.map(([c, n]) => (
              <button
                key={c}
                type="button"
                className={`rules-cat-item ${activeCat === c ? 'active' : ''}`}
                onClick={() => onCatClick(c)}
                aria-current={activeCat === c ? 'page' : undefined}
                data-testid={`cat-${c}`}
              >
                <span className="rules-cat-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    {ICONS[CATEGORY_ICON[c] ?? '整']}
                  </svg>
                </span>
                <span className="rules-cat-name">{CATEGORY_LABEL[c]}</span>
                <span className="rules-cat-count">{n}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Resizer for side rail */}
        <div className="rules-resizer rules-resizer-v" {...sideRail.resizerProps} aria-label="拖动调整侧边栏宽度" />

        {/* ── Main 2-pane (set list + rule list) ───────────────────── */}
        <main className="rules-market-main">
          {!activeCat || setsInActiveCat.length === 0 ? (
            <div className="rules-empty">
              <div className="rules-empty-icon" aria-hidden>
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
              </div>
              <h2 className="rules-empty-title">{activeCat ? `${CATEGORY_LABEL[activeCat]} 没有规则集` : '从左侧选一个分类'}</h2>
              <p className="rules-empty-sub">
                {activeCat
                  ? (scope === 'mine' ? '切换到「所有规则」可以查看更多。' : '该分类暂时没有规则集。')
                  : `${installedCount} 项已启用 · 共 ${RULE_SETS.length} 个 set 可选`}
              </p>
            </div>
          ) : (
            <>
              {/* Set list (left) */}
              <section className="rules-set-pane" data-testid="set-pane">
                <header className="rules-pane-head">
                  <div className="rules-pane-eyebrow">分类 · {CATEGORY_LABEL[activeCat]}</div>
                  <h2 className="rules-pane-title">{CATEGORY_LABEL[activeCat]}</h2>
                  <p className="rules-pane-sub">{setsInActiveCat.length} 个规则集</p>
                </header>
                <ul className="rules-set-list" role="list">
                  {setsInActiveCat.map((s) => {
                    const installed = installedSets.has(s.id);
                    const selected = s.id === selectedSetId;
                    return (
                      <li
                        key={s.id}
                        className={`rules-set-item ${selected ? 'selected' : ''} ${installed ? 'installed' : ''}`}
                        onClick={() => setSelectedSetId(selected ? null : s.id)}
                        data-set-id={s.id}
                        data-testid={`set-${s.id}`}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedSetId(selected ? null : s.id);
                          }
                        }}
                      >
                        <div className="rules-set-icon" aria-hidden>
                          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            {ICONS[s.icon] ?? ICONS['整']}
                          </svg>
                        </div>
                        <div className="rules-set-body">
                          <div className="rules-set-head">
                            <span className="rules-set-name">{s.name}</span>
                            <span className={`source-badge source-${s.source}`}>{SOURCE_LABEL[s.source]}</span>
                          </div>
                          <div className="rules-set-desc">{s.description}</div>
                          <div className="rules-set-meta">
                            <span>{s.ruleIds.length} 条规则</span>
                            <span className="sep">·</span>
                            <span>{fmtInstalls(s.installs)} 安装</span>
                            {s.rating > 0 && (<><span className="sep">·</span><span>★ {s.rating.toFixed(1)}</span></>)}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {/* Resizer between set list and rule list */}
              <div className="rules-resizer rules-resizer-v" {...rulePane.resizerProps} aria-label="拖动调整规则面板宽度" role="separator" />

              {/* Rule list (right) — only when a set is selected */}
              <section
                className={`rules-rule-pane ${selectedSet ? 'open' : ''}`}
                data-testid="rule-pane"
                aria-hidden={!selectedSet}
                style={{ width: rulePane.width }}
              >
                {selectedSet && (
                  <>
                    <header className="rules-pane-head">
                      <div className="rules-pane-eyebrow">规则集</div>
                      <h2 className="rules-pane-title">{selectedSet.name}</h2>
                      <p className="rules-pane-sub">
                        {selectedSetRules.length} 条具体规则
                        <button
                          type="button"
                          className="btn btn-ghost rules-set-toggle"
                          onClick={() => toggleSet(selectedSet, !installedSets.has(selectedSet.id))}
                          data-testid={`set-toggle-${selectedSet.id}`}
                        >
                          {installedSets.has(selectedSet.id) ? '停用全部' : '启用全部'}
                        </button>
                      </p>
                    </header>
                    <ul className="rules-rule-list" role="list">
                      {selectedSetRules.map((r) => {
                        const on = configs[r.id]?.enabled !== false;
                        return (
                          <li
                            key={r.id}
                            className="rules-rule-row"
                            onClick={() => openRule(r, selectedSet)}
                            data-rule-id={r.id}
                            data-rule-row
                          >
                            <span className={`rules-rule-sev sev-${r.severity}`} title={SEVERITY_LABEL[r.severity]} />
                            <div className="rules-rule-body">
                              <div className="rules-rule-name">{r.title}</div>
                              <div className="rules-rule-desc">{r.tldr}</div>
                            </div>
                            <button
                              type="button"
                              className={`rules-rule-toggle ${on ? 'on' : ''}`}
                              aria-pressed={on}
                              aria-label={`切换 ${r.title}`}
                              onClick={(e) => { e.stopPropagation(); toggleRule(r.id, selectedSet.id, !on); }}
                              data-testid={`rule-toggle-${r.id}`}
                            >
                              <span className="rules-rule-toggle-knob" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </section>
            </>
          )}
        </main>
      </div>

      {/* Drawer */}
      <div className={`drawer-overlay ${drawerRule ? 'open' : ''}`} onClick={closeDrawer} aria-hidden={!drawerRule} />
      <aside className={`drawer ${drawerRule ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label="规则配置">
        {drawerRule && drawerConfig && (
          <>
            <div className="drawer-head">
              <h3>
                {drawerSet && (
                  <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-sans)', fontWeight: 500, marginRight: 6 }}>{drawerSet.name} /</span>
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
                    <button key={s} type="button" role="tab" aria-selected={drawerConfig.threshold === s} className={drawerConfig.threshold === s ? 'active' : ''} onClick={() => updateConfig({ threshold: s })}>
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
                    <span key={g} className="drawer-glob">{g}<button type="button" onClick={() => removeGlob(g)} aria-label={`移除 ${g}`}>×</button></span>
                  ))}
                  <button type="button" className="drawer-add-glob" onClick={() => { const next = window.prompt('添加 glob 表达式:'); if (next) addGlob(next); }}>+ 添加</button>
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

// Map set categories → icon name from ICONS map
const CATEGORY_ICON: Record<RuleSetCategory, keyof typeof ICONS> = {
  security: '盾',
  quality: '整',
  architecture: '模',
  file: '文',
  testing: '测',
  config: '配',
  documentation: '档',
};