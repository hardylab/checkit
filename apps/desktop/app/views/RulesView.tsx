'use client';
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
const e = React.createElement;
const ICONS: Record<string, React.ReactNode> = {
  盾: e('path', { d: 'm9 12 2 2 4-4' }),
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

export function RulesView() {
  const navigate = useNavigate();
  const [scope, setScope] = useState<Scope>('all');
  const [activeCat, setActiveCat] = useState<RuleSetCategory | null>(null);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [installedRules, setInstalledRules] = useState<Set<string>>(new Set());
  const [installedSets, setInstalledSets] = useState<Set<string>>(new Set());
  const [configs, setConfigs] = useState<Record<string, RuleConfig>>({});
  const [allRules, setAllRules] = useState<RuleDoc[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [drawerRule, setDrawerRule] = useState<RuleDoc | null>(null);
  const [drawerSet, setDrawerSet] = useState<RuleSet | null>(null);
  const [drawerBody, setDrawerBody] = useState<string | null>(null);
  const [drawerConfig, setDrawerConfig] = useState<RuleConfig | null>(null);

  const [hydrated, setHydrated] = useState(false);

  const sideRailRef = useRef<HTMLElement>(null);
  const rulePaneRef = useRef<HTMLElement>(null);

  const sideRail = useColumnLayout({
    columnRef: sideRailRef,
    columnKey: 'side-rail',
    defaultWidth: 240,
    min: 160, max: 360, side: 'left',
  });
  const rulePane = useColumnLayout({
    columnRef: rulePaneRef,
    columnKey: 'rule-pane',
    defaultWidth: 360,
    min: 240, max: 560, side: 'right',
  });

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
    setHydrated(true);
  }, []);

  useEffect(() => { if (hydrated) try { localStorage.setItem(RULE_CONFIG_KEY, JSON.stringify(configs)); } catch {} }, [configs, hydrated]);
  useEffect(() => { if (hydrated) try { localStorage.setItem(INSTALLED_RULES_KEY, JSON.stringify([...installedRules])); } catch {} }, [installedRules, hydrated]);
  useEffect(() => { if (hydrated) try { localStorage.setItem(INSTALLED_SETS_KEY, JSON.stringify([...installedSets])); } catch {} }, [installedSets, hydrated]);

  const cats = useMemo(() => {
    const map = new Map<RuleSetCategory, number>();
    for (const s of RULE_SETS) {
      if (scope === 'mine' && !installedSets.has(s.id)) continue;
      map.set(s.category, (map.get(s.category) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [scope, installedSets]);

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

  const selectedSetRules = useMemo<RuleDoc[]>(() => {
    if (!selectedSet) return [];
    return selectedSet.ruleIds
      .map((id) => allRules.find((r) => r.id === id))
      .filter((r): r is RuleDoc => !!r);
  }, [selectedSet, allRules]);

  const installedCount = installedSets.size;

  return (
    <>
      <div className="rules-shell">
        <aside
          ref={sideRailRef}
          className="rules-side-rail"
          aria-label="规则分类导航"
          style={{ width: `${sideRail.width}px` }}
        >
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
                    {ICONS['整']}
                  </svg>
                </span>
                <span className="rules-cat-name">{CATEGORY_LABEL[c]}</span>
                <span className="rules-cat-count">{n}</span>
              </button>
            ))}
          </nav>

          <div
            className="rules-resizer rules-resizer-v"
            style={{ right: 0 }}
            {...sideRail.resizerProps}
            aria-label="拖动调整侧边栏宽度"
          />
        </aside>

        <section className="rules-market-main">
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
              <section className="rules-set-pane" data-testid="set-pane">
                <header className="rules-pane-head">
                  <div className="rules-pane-eyebrow">分类 · {CATEGORY_LABEL[activeCat]}</div>
                  <h2 className="rules-pane-title">{CATEGORY_LABEL[activeCat]}</h2>
                  <p className="rules-pane-sub">{setsInActiveCat.length} 个规则集</p>
                </header>
                <BulkAddToPresetsBar
                  disabled={false}
                  allRulesInActiveCat={(() => {
                    const ids = new Set<string>();
                    for (const s of setsInActiveCat) for (const id of s.ruleIds) ids.add(id);
                    return Array.from(ids);
                  })()}
                  onAdded={() => setHydrated(false)}
                />
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

              <section
                ref={rulePaneRef}
                className={`rules-rule-pane ${selectedSet ? 'open' : ''}`}
                data-testid="rule-pane"
                aria-hidden={!selectedSet}
                style={{ width: rulePane.width }}
              >
                <div
                  className="rules-resizer rules-resizer-v"
                  style={{ left: 0 }}
                  {...rulePane.resizerProps}
                  aria-label="拖动调整规则面板宽度"
                  role="separator"
                />
                {selectedSet && (
                  <>
                    <header className="rules-pane-head">
                      <div className="rules-pane-eyebrow">规则集</div>
                      <h2 className="rules-pane-title">{selectedSet.name}</h2>
                      <p className="rules-pane-sub">{selectedSetRules.length} 条具体规则</p>
                    </header>
                    <ul className="rules-rule-list" role="list">
                      {selectedSetRules.map((r) => (
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
                          <RuleAddToPresets rule={r} onAdded={() => setHydrated(false)} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            </>
          )}
        </section>
      </div>

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
                <label className="drawer-toggle">
                  <input
                    type="checkbox"
                    data-testid="drawer-enabled"
                    checked={drawerConfig.enabled}
                    onChange={(e) => updateConfig({ enabled: e.target.checked })}
                  />
                  <span>启用此规则</span>
                </label>
              </div>
              <div className="drawer-section">
                <h4>严重等级阈值</h4>
                <div className="drawer-sev-row">
                  {(['error', 'warning', 'info'] as const).map((lv) => (
                    <button
                      key={lv}
                      type="button"
                      className={`drawer-sev-pill ${drawerConfig.threshold === lv ? 'active' : ''}`}
                      onClick={() => updateConfig({ threshold: lv })}
                      data-testid={`threshold-${lv}`}
                    >
                      {SEVERITY_LABEL[lv]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="drawer-section">
                <h4>应用范围</h4>
                <ul className="drawer-glob-list">
                  {drawerConfig.globs.map((g) => (
                    <li key={g}>
                      <code>{g}</code>
                      <button type="button" onClick={() => removeGlob(g)} aria-label={`删除 ${g}`}>×</button>
                    </li>
                  ))}
                </ul>
                <AddGlob onAdd={addGlob} />
              </div>
              {exampleCode && (
                <div className="drawer-section">
                  <h4>示例 / 触发条件</h4>
                  <pre className="drawer-code"><code>{exampleCode}</code></pre>
                </div>
              )}
            </div>
            <div className="drawer-foot">
              <button type="button" className="btn btn-ghost" onClick={resetConfig}>恢复默认</button>
              <button type="button" className="btn btn-primary" onClick={saveConfig} data-testid="drawer-save">保存配置</button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function AddGlob({ onAdd }: { onAdd: (g: string) => void }) {
  const [v, setV] = useState('');
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onAdd(v); setV(''); }}
      style={{ display: 'flex', gap: 6, marginTop: 8 }}
    >
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="src/**"
        style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--surface)', color: 'var(--fg)' }}
      />
      <button type="submit" className="btn btn-ghost">+</button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────
// "添加到 Preset" dropdown — replaces the old per-rule Switch toggle.
// User picks one or more user-created presets; the rule is added to each.
// PATCH /api/presets/[id] { addRules: [ruleId] }.
// ─────────────────────────────────────────────────────────────────
interface PresetLite { id: string; name: string; scope: 'project' | 'global' }

function usePresetsList(): { presets: PresetLite[]; loading: boolean; reload: () => void } {
  const [presets, setPresets] = useState<PresetLite[]>([]);
  const [loading, setLoading] = useState(false);
  const reload = useCallback(() => {
    setLoading(true);
    fetch('/api/presets', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: { presets?: PresetLite[] }) => {
        setPresets(j.presets ?? []);
      })
      .catch(() => setPresets([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { presets, loading, reload };
}

function RuleAddToPresets({ rule, onAdded }: { rule: { id: string; title: string }; onAdded?: () => void }) {
  const { presets, loading, reload } = usePresetsList();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<null | 'ok' | 'err'>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function togglePick(id: string) {
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function commit() {
    if (picked.size === 0) return;
    setSaving(true);
    setStatus(null);
    try {
      for (const id of picked) {
        const r = await fetch(`/api/presets/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addRules: [rule.id] }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
          throw new Error(j.error || r.statusText);
        }
      }
      setStatus('ok');
      setPicked(new Set());
      setOpen(false);
      reload();
      onAdded?.();
    } catch {
      setStatus('err');
    } finally {
      setSaving(false);
    }
  }

  if (loading && presets.length === 0) {
    return <span className="rule-add-to-presets" />;
  }

  return (
    <div
      className="rule-add-to-presets"
      ref={wrapRef}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="rule-add-to-presets-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid={`add-to-preset-${rule.id}`}
        title="添加到 Preset"
      >
        {status === 'ok' ? '✓ 已添加' : '+ 添加到'}
      </button>
      {open && (
        <div className="rule-add-to-presets-menu" role="listbox">
          {presets.length === 0 ? (
            <p className="rule-add-to-presets-empty">还没有 Preset。切到 Preset tab 新建一个。</p>
          ) : (
            <>
              <ul className="rule-add-to-presets-list">
                {presets.map((p) => (
                  <li key={`${p.scope}:${p.id}`}>
                    <label>
                      <input
                        type="checkbox"
                        checked={picked.has(p.id)}
                        onChange={() => togglePick(p.id)}
                      />
                      <span className="rule-add-to-presets-name">{p.name}</span>
                      <span className="rule-add-to-presets-scope">{p.scope}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="rule-add-to-presets-foot">
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={saving}>取消</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={commit}
                  disabled={saving || picked.size === 0}
                  data-testid={`add-to-preset-confirm-${rule.id}`}
                >
                  {saving ? '保存中…' : `添加到 ${picked.size} 个 Preset`}
                </button>
              </div>
            </>
          )}
          {status === 'err' && <p className="rule-add-to-presets-error">⚠ 保存失败,重试</p>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Bulk "一键添加到" bar at the top of the rules list.
// User picks presets; we add ALL rules in the currently-active category
// to each picked preset in one shot.
// ─────────────────────────────────────────────────────────────────
function BulkAddToPresetsBar({
  disabled,
  allRulesInActiveCat,
  onAdded,
}: {
  disabled: boolean;
  allRulesInActiveCat: string[];
  onAdded?: () => void;
}) {
  const { presets, loading } = usePresetsList();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<null | 'ok' | 'err'>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function togglePick(id: string) {
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function commit() {
    if (picked.size === 0 || allRulesInActiveCat.length === 0) return;
    setSaving(true);
    setStatus(null);
    try {
      for (const id of picked) {
        const r = await fetch(`/api/presets/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addRules: allRulesInActiveCat }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
          throw new Error(j.error || r.statusText);
        }
      }
      setStatus('ok');
      setPicked(new Set());
      setOpen(false);
      onAdded?.();
    } catch {
      setStatus('err');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`bulk-add-bar ${disabled ? 'is-disabled' : ''}`}
      ref={wrapRef}
      data-testid="bulk-add-bar"
    >
      <div className="bulk-add-bar-info">
        <span className="bulk-add-bar-icon" aria-hidden>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </span>
        <span className="bulk-add-bar-text">
          一键添加到 Preset · 当前分类共 <strong>{allRulesInActiveCat.length}</strong> 条规则
        </span>
      </div>
      <button
        type="button"
        className="btn btn-primary"
        disabled={disabled || loading || presets.length === 0 || allRulesInActiveCat.length === 0}
        onClick={() => setOpen((o) => !o)}
        data-testid="bulk-add-trigger"
      >
        选择 Preset…
      </button>
      {status === 'ok' && <span className="bulk-add-bar-status">✓ 已加入</span>}
      {status === 'err' && <span className="bulk-add-bar-status error">⚠ 失败</span>}
      {open && (
        <div className="bulk-add-menu" role="listbox">
          {presets.length === 0 ? (
            <p className="bulk-add-menu-empty">还没有 Preset。切到 Preset tab 新建一个。</p>
          ) : (
            <>
              <ul className="bulk-add-list">
                {presets.map((p) => (
                  <li key={`${p.scope}:${p.id}`}>
                    <label>
                      <input
                        type="checkbox"
                        checked={picked.has(p.id)}
                        onChange={() => togglePick(p.id)}
                      />
                      <span>{p.name}</span>
                      <span className="bulk-add-scope">{p.scope}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="bulk-add-foot">
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={saving}>取消</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={commit}
                  disabled={saving || picked.size === 0}
                  data-testid="bulk-add-confirm"
                >
                  {saving ? '保存中…' : `一键加入 ${picked.size || ''} 个 Preset`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
