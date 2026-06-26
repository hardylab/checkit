'use client';
// PresetView — Preset tab in the desktop sidebar.
//
// Each entry the user creates shows up here as a row in the list.
// Selecting a row loads the preset's details on the right: rules with
// Switch toggles (same as the old per-rule Switch the RulesView used
// to have), and a "used in workspaces" section showing every workspace
// that has this preset applied. The Switch toggles write back to
// ~/.checkit/presets/<id>.preset.json via the CLI's preset update command.

import React, { useEffect, useState, useCallback } from 'react';

interface PresetDoc {
  id: string;
  name: string;
  description?: string;
  version?: string;
  source?: 'bundled' | 'manual' | 'ai-generated' | 'imported';
  scope: 'project' | 'global';
  /** CLI list output uses `rule_count`; the full preset (show) uses `rules`. */
  rules?: Array<{
    id: string;
    enabled?: boolean;
    threshold?: 'off' | 'warn' | 'error';
    globs?: string[];
  }>;
  rule_count?: number;
  usedInWorkspaces?: string[];
  metadata?: { created_at?: string; updated_at?: string; created_from?: string };
}

interface WorkspaceLite {
  id: string;
  name: string;
  presetIds: string[];
  roots: string[];
  lastScannedAt?: string;
}

export function PresetView() {
  const [presets, setPresets] = useState<PresetDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceLite[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, w] = await Promise.all([
        fetch('/api/presets', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/workspaces', { cache: 'no-store' }).then((r) => r.json()),
      ]);
      const list: PresetDoc[] = p.presets ?? [];
      setPresets(list);
      setWorkspaces(w.workspaces ?? []);
      if (!selectedId && list.length > 0) setSelectedId(list[0].id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = presets.find((p) => p.id === selectedId) ?? null;

  async function createPreset() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    try {
      const r = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: name, name, rules: [] }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        throw new Error(j.error || r.statusText);
      }
      setNewName('');
      setCreating(false);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deletePreset(id: string) {
    if (!confirm(`删除 Preset "${id}"?`)) return;
    setError(null);
    try {
      const r = await fetch(`/api/presets/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        throw new Error(j.error || r.statusText);
      }
      if (selectedId === id) setSelectedId(null);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function toggleRule(ruleId: string, currentlyEnabled: boolean) {
    if (!selected) return;
    setError(null);
    try {
      // We use the "remove then add" pattern: removing then re-adding is
      // awkward, so we use a different approach: PATCH a fresh addRules /
      // removeRules list. To toggle a single rule, we send the desired
      // outcome — for "off", remove the rule; for "on", add it back
      // (only if it was already removed).
      // For simplicity we just send the toggle as remove+add:
      //   if currentlyEnabled: remove this rule + add all the other
      //     currently-enabled rules back.
      //   if !currentlyEnabled: add this rule.
      // But that loses other rules' state. Better: use the underlying
      // store's `writePreset` directly. For V1 we accept a simpler
      // "add/remove" toggle that just adds the rule back. This will
      // duplicate the rule in the JSON if the user toggles off then on
      // — we dedupe in the CLI's cmdPresetUpdate.
      const op = currentlyEnabled
        ? { removeRules: [ruleId] }
        : { addRules: [ruleId] };
      const r = await fetch(`/api/presets/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(op),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        throw new Error(j.error || r.statusText);
      }
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="preset-view" data-testid="preset-view">
      <header className="view-head">
        <div className="view-head-left">
          <h1 className="view-title">Preset</h1>
          <p className="view-sub">用户自定义规则集 · {presets.length} 个</p>
        </div>
        <div className="view-head-right">
          {!creating && (
            <button className="btn btn-primary" onClick={() => setCreating(true)} data-testid="preset-new">
              + 新建 Preset
            </button>
          )}
        </div>
      </header>

      {error && <div className="view-error">⚠ {error}</div>}

      {creating && (
        <form
          className="preset-create-form"
          onSubmit={(e) => { e.preventDefault(); createPreset(); }}
        >
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Preset 名称(例如: my-team-style)"
            data-testid="preset-new-name"
          />
          <button type="submit" className="btn btn-primary" data-testid="preset-new-submit">创建</button>
          <button type="button" className="btn btn-ghost" onClick={() => { setCreating(false); setNewName(''); }}>取消</button>
        </form>
      )}

      <div className="preset-shell">
        <aside className="preset-list" aria-label="Preset 列表">
          {loading && presets.length === 0 && <p className="preset-empty">加载中…</p>}
          {!loading && presets.length === 0 && !creating && (
            <p className="preset-empty">还没有 Preset。点「新建 Preset」创建第一个。</p>
          )}
          <ul className="preset-list-ul" role="list">
            {presets.map((p) => (
              <li
                key={`${p.scope}:${p.id}`}
                className={`preset-row ${selectedId === p.id ? 'active' : ''}`}
                onClick={() => setSelectedId(p.id)}
                data-testid={`preset-row-${p.id}`}
              >
                <div className="preset-row-name">{p.name}</div>
                <div className="preset-row-meta">
                  <span className="source-badge source-{p.source}">{p.source ?? 'manual'}</span>
                  <span className="preset-row-count">{(p.rules?.length ?? p.rule_count ?? 0)} 条规则</span>
                  {p.usedInWorkspaces && p.usedInWorkspaces.length > 0 && (
                    <span className="preset-row-usage">用于 {p.usedInWorkspaces.length} 个 workspace</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <section className="preset-detail">
          {selected ? (
            <PresetDetail
              preset={selected}
              workspaces={workspaces}
              onToggleRule={toggleRule}
              onDelete={deletePreset}
            />
          ) : (
            <p className="preset-detail-empty">从左边选一个 Preset 看详情。</p>
          )}
        </section>
      </div>
    </div>
  );
}

function PresetDetail({
  preset,
  workspaces,
  onToggleRule,
  onDelete,
}: {
  preset: PresetDoc;
  workspaces: WorkspaceLite[];
  onToggleRule: (ruleId: string, currentlyEnabled: boolean) => void;
  onDelete: (id: string) => void;
}) {
  // The list-row preset lacks `rules` (only has rule_count). Fetch the
  // full preset on mount so the detail view can render the Switch
  // toggles. Merge the fresh data into a local "full" state.
  const [full, setFull] = useState<PresetDoc>(preset);
  useEffect(() => {
    let cancelled = false;
    setFull(preset);
    fetch(`/api/presets/${encodeURIComponent(preset.id)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { preset?: PresetDoc } | null) => {
        if (cancelled || !j?.preset) return;
        setFull(j.preset);
      })
      .catch(() => { /* ignore — keep list shape */ });
    return () => { cancelled = true; };
  }, [preset.id, preset.scope]);
  const usedIn = (full.usedInWorkspaces ?? []).map((id) => {
    const w = workspaces.find((x) => x.id === id);
    return { id, name: w?.name ?? id, exists: !!w };
  });

  return (
    <div className="preset-detail-inner" data-testid={`preset-detail-${preset.id}`}>
      <header className="preset-detail-head">
        <div>
          <h2 className="preset-detail-name">{preset.name}</h2>
          <p className="preset-detail-id">id: <code>{preset.id}</code> · scope: <code>{preset.scope}</code> · source: <code>{preset.source ?? 'manual'}</code></p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => onDelete(preset.id)}
          data-testid={`preset-delete-${preset.id}`}
        >
          删除
        </button>
      </header>

      {preset.description && <p className="preset-detail-desc">{preset.description}</p>}

      <section className="preset-section">
        <h3 className="preset-section-title">规则 (Switch 控制)</h3>
        {(full.rules?.length ?? 0) === 0 ? (
          <p className="preset-empty">这个 Preset 还没有规则。去「规则市场」用「添加到」按钮加。</p>
        ) : (
          <ul className="preset-rule-list" role="list">
            {(full.rules ?? []).map((r) => {
              const on = r.enabled !== false;
              return (
                <li
                  key={r.id}
                  className="preset-rule-row"
                  data-rule-id={r.id}
                >
                  <div className="preset-rule-body">
                    <code className="preset-rule-id">{r.id}</code>
                    <span className="preset-rule-thresh">{r.threshold ?? 'error'}</span>
                    {r.globs && r.globs.length > 0 && (
                      <span className="preset-rule-globs">{r.globs.join(', ')}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    className={`preset-rule-switch ${on ? 'on' : ''}`}
                    onClick={() => onToggleRule(r.id, on)}
                    data-testid={`preset-rule-switch-${r.id}`}
                  >
                    <span className="preset-rule-switch-knob" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="preset-section">
        <h3 className="preset-section-title">应用到 Workspace ({usedIn.length})</h3>
        {usedIn.length === 0 ? (
          <p className="preset-empty">还没有 Workspace 应用这个 Preset。去 Workspace tab 加。</p>
        ) : (
          <ul className="preset-usage-list" role="list">
            {usedIn.map((u) => (
              <li key={u.id} className={`preset-usage-row ${u.exists ? '' : 'missing'}`}>
                <span className="preset-usage-name">{u.name}</span>
                <code className="preset-usage-id">{u.id}</code>
                {!u.exists && <span className="preset-usage-warn">(workspace 已被删除)</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
