'use client';
// WorkspaceView — Workspace tab in the desktop sidebar.
//
// Each workspace is a named scope bundling:
//   - one or more project root directories
//   - one or more presets (rulesets) applied during scan
//
// The top-right of the detail view has a 「检测」 button that triggers
// `lintany workspace scan <id>`, which runs the lintany scan pipeline
// against every root and reports per-root issue counts.

import React, { useEffect, useState, useCallback, useRef } from 'react';

interface WorkspaceDoc {
  id: string;
  name: string;
  description?: string;
  roots: string[];
  presetIds: string[];
  lastScannedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface PresetLite {
  id: string;
  name: string;
  scope: 'project' | 'global';
}

export function WorkspaceView() {
  const [workspaces, setWorkspaces] = useState<WorkspaceDoc[]>([]);
  const [presets, setPresets] = useState<PresetLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [w, p] = await Promise.all([
        fetch('/api/workspaces', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/presets', { cache: 'no-store' }).then((r) => r.json()),
      ]);
      setWorkspaces(w.workspaces ?? []);
      setPresets(p.presets ?? []);
      if (!selectedId && (w.workspaces ?? []).length > 0) {
        setSelectedId((w.workspaces ?? [])[0].id);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = workspaces.find((w) => w.id === selectedId) ?? null;

  async function createWorkspace() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    try {
      // Pre-fill one root with the current shell cwd so the user can hit
      // 检测 immediately. They can edit it after.
      const initialRoot = await (async () => {
        try {
          const r = await fetch('/api/scan', { method: 'GET' });
          // No GET — skip.
        } catch { /* ignore */ }
        return '';
      })();
      const r = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: name,
          name,
          roots: initialRoot ? [initialRoot] : [],
          presetIds: [],
        }),
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

  async function deleteWorkspace(id: string) {
    if (!confirm(`删除 Workspace "${id}"?`)) return;
    setError(null);
    try {
      const r = await fetch(`/api/workspaces/${encodeURIComponent(id)}`, { method: 'DELETE' });
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

  return (
    <div className="workspace-view" data-testid="workspace-view">
      <header className="view-head">
        <div className="view-head-left">
          <h1 className="view-title">Workspace</h1>
          <p className="view-sub">多目录 + 多 Preset 的扫描单元 · {workspaces.length} 个</p>
        </div>
        <div className="view-head-right">
          {!creating && (
            <button className="btn btn-primary" onClick={() => setCreating(true)} data-testid="workspace-new">
              + 新建 Workspace
            </button>
          )}
        </div>
      </header>

      {error && <div className="view-error">⚠ {error}</div>}

      {creating && (
        <form
          className="workspace-create-form"
          onSubmit={(e) => { e.preventDefault(); createWorkspace(); }}
        >
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Workspace 名称(例如: my-monorepo)"
            data-testid="workspace-new-name"
          />
          <button type="submit" className="btn btn-primary">创建</button>
          <button type="button" className="btn btn-ghost" onClick={() => { setCreating(false); setNewName(''); }}>取消</button>
        </form>
      )}

      <div className="workspace-shell">
        <aside className="workspace-list" aria-label="Workspace 列表">
          {loading && workspaces.length === 0 && <p className="workspace-empty">加载中…</p>}
          {!loading && workspaces.length === 0 && !creating && (
            <p className="workspace-empty">还没有 Workspace。点「新建 Workspace」创建第一个。</p>
          )}
          <ul className="workspace-list-ul" role="list">
            {workspaces.map((w) => (
              <li
                key={w.id}
                className={`workspace-row ${selectedId === w.id ? 'active' : ''}`}
                onClick={() => setSelectedId(w.id)}
                data-testid={`workspace-row-${w.id}`}
              >
                <div className="workspace-row-name">{w.name}</div>
                <div className="workspace-row-meta">
                  <span>{w.roots.length} 目录</span>
                  <span className="sep">·</span>
                  <span>{w.presetIds.length} Preset</span>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <section className="workspace-detail">
          {selected ? (
            <WorkspaceDetail
              workspace={selected}
              availablePresets={presets}
              onDelete={deleteWorkspace}
              onChanged={reload}
            />
          ) : (
            <p className="workspace-detail-empty">从左边选一个 Workspace 看详情。</p>
          )}
        </section>
      </div>
    </div>
  );
}

function WorkspaceDetail({
  workspace,
  availablePresets,
  onDelete,
  onChanged,
}: {
  workspace: WorkspaceDoc;
  availablePresets: PresetLite[];
  onDelete: (id: string) => void;
  onChanged: () => void;
}) {
  const [roots, setRoots] = useState<string[]>(workspace.roots);
  const [newRoot, setNewRoot] = useState('');
  const [presetIds, setPresetIds] = useState<string[]>(workspace.presetIds);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<null | { root: string; ok: boolean; issues: unknown[]; error?: string }[]>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const scanPollRef = useRef<number | null>(null);

  useEffect(() => {
    setRoots(workspace.roots);
    setPresetIds(workspace.presetIds);
  }, [workspace.id, workspace.roots, workspace.presetIds]);

  function addRoot() {
    const r = newRoot.trim();
    if (!r) return;
    if (roots.includes(r)) {
      setNewRoot('');
      return;
    }
    setRoots([...roots, r]);
    setNewRoot('');
  }
  function removeRoot(r: string) {
    setRoots(roots.filter((x) => x !== r));
  }
  function togglePreset(id: string) {
    setPresetIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await fetch(`/api/workspaces/${encodeURIComponent(workspace.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roots, presetIds }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        throw new Error(j.error || r.statusText);
      }
      setSuccess('已保存');
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function scan() {
    setScanning(true);
    setError(null);
    setScanResult(null);
    try {
      // Make sure the latest state is on disk first.
      await save();
      const r = await fetch(`/api/workspaces/${encodeURIComponent(workspace.id)}/scan`, { method: 'POST' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        throw new Error(j.error || r.statusText);
      }
      const j = await r.json() as { result?: { results?: { root: string; ok: boolean; issues: unknown[]; error?: string }[] } };
      setScanResult(j.result?.results ?? []);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setScanning(false);
    }
  }

  useEffect(() => {
    return () => {
      if (scanPollRef.current !== null) {
        window.clearInterval(scanPollRef.current);
      }
    };
  }, []);

  return (
    <div className="workspace-detail-inner" data-testid={`workspace-detail-${workspace.id}`}>
      <header className="workspace-detail-head">
        <div>
          <h2 className="workspace-detail-name">{workspace.name}</h2>
          <p className="workspace-detail-id">id: <code>{workspace.id}</code></p>
        </div>
        <div className="workspace-detail-actions">
          <button
            type="button"
            className="btn btn-primary workspace-detect-btn"
            onClick={scan}
            disabled={scanning || saving}
            data-testid={`workspace-detect-${workspace.id}`}
          >
            {scanning ? '检测中…' : '检测'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onDelete(workspace.id)}
            data-testid={`workspace-delete-${workspace.id}`}
          >
            删除
          </button>
        </div>
      </header>

      {error && <div className="view-error">⚠ {error}</div>}
      {success && <div className="view-success">✓ {success}</div>}

      <section className="workspace-section">
        <h3 className="workspace-section-title">目录 ({roots.length})</h3>
        <ul className="workspace-roots-list" role="list">
          {roots.map((r) => (
            <li key={r} className="workspace-root-row">
              <code className="workspace-root-path">{r}</code>
              <button
                type="button"
                className="btn btn-ghost workspace-root-remove"
                onClick={() => removeRoot(r)}
                aria-label={`移除 ${r}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <form
          className="workspace-root-add"
          onSubmit={(e) => { e.preventDefault(); addRoot(); }}
        >
          <input
            value={newRoot}
            onChange={(e) => setNewRoot(e.target.value)}
            placeholder="D:\\path\\to\\project 或 /home/user/project"
            data-testid={`workspace-root-input-${workspace.id}`}
          />
          <button type="submit" className="btn btn-ghost" data-testid={`workspace-root-add-${workspace.id}`}>+</button>
        </form>
      </section>

      <section className="workspace-section">
        <h3 className="workspace-section-title">应用 Preset ({presetIds.length})</h3>
        {availablePresets.length === 0 ? (
          <p className="workspace-empty">还没有 Preset。先去 Preset tab 创建一个。</p>
        ) : (
          <ul className="workspace-presets-list" role="list">
            {availablePresets.map((p) => {
              const on = presetIds.includes(p.id);
              return (
                <li key={`${p.scope}:${p.id}`} className="workspace-preset-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => togglePreset(p.id)}
                      data-testid={`workspace-preset-${p.id}`}
                    />
                    <span>{p.name}</span>
                    <span className="workspace-preset-scope">{p.scope}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="workspace-section">
        <div className="workspace-section-head">
          <h3 className="workspace-section-title">最近扫描</h3>
          <button
            type="button"
            className="btn btn-primary"
            onClick={save}
            disabled={saving || scanning}
            data-testid={`workspace-save-${workspace.id}`}
          >
            {saving ? '保存中…' : '保存配置'}
          </button>
        </div>
        {workspace.lastScannedAt && (
          <p className="workspace-last-scan">
            上次扫描: {new Date(workspace.lastScannedAt).toLocaleString()}
          </p>
        )}
        {scanResult && (
          <ul className="workspace-scan-results" role="list">
            {scanResult.map((r, i) => (
              <li key={i} className={`workspace-scan-row ${r.ok ? 'ok' : 'warn'}`}>
                <span className="workspace-scan-status">{r.ok ? '✓' : '⚠'}</span>
                <code className="workspace-scan-root">{r.root}</code>
                <span className="workspace-scan-issues">
                  {Array.isArray(r.issues) ? `${r.issues.length} issues` : ''}
                </span>
                {r.error && <span className="workspace-scan-err">{r.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
