'use client';
// SettingsModal — LintAny system settings dialog.
//
// Two pieces:
//   1. **Custom providers** (the Provider dropdown). Built-ins are
//      local-keyword / openai / claude / minimax / ollama. The user
//      can add their own (deepseek, doubao, moonshot, …) via
//      "新增" — once added, the new provider sits in the dropdown
//      alongside the built-ins, and is editable / removable.
//      Storage: ~/.checkit/custom-providers/<id>.json
//   2. **Active LLM credentials** (model / baseUrl / apiKey).
//      These live in the main ~/.checkit/config.json and identify
//      which provider is currently active (`ai.adapter = <id>`).
//
// On save:
//   - If the user picked a built-in: write ai.adapter=<builtin>.
//   - If the user picked a custom: write ai.adapter=<customId>.
//   - Always also write model / baseUrl / apiKey if non-empty.
//   - Run `lintany config test` to verify the LLM is reachable before
//     reporting success; on failure, roll back any keys we wrote.

import React, { useEffect, useState } from 'react';

interface ConfigResponse {
  config: Record<string, string>;
  file: string;
  error?: string;
}

interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
}

const BUILTIN_PRESETS: Record<string, { defaultBaseUrl: string; defaultModel: string; label: string }> = {
  'local-keyword': { defaultBaseUrl: '',                       defaultModel: '(no LLM)',       label: 'Local keyword (offline, no key)' },
  openai:         { defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini',    label: 'OpenAI / Azure / Together / OpenRouter' },
  claude:         { defaultBaseUrl: 'https://api.anthropic.com', defaultModel: 'claude-sonnet-4-5', label: 'Anthropic Claude' },
  minimax:        { defaultBaseUrl: 'https://api.minimaxi.com/v1', defaultModel: 'MiniMax-M3',  label: 'MiniMax' },
  ollama:         { defaultBaseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3',     label: 'Ollama (local)' },
};

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
);

const KeyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21 2-9.6 9.6"/>
    <path d="m15.5 7.5 3 3L8 21H2v-6L15.5 7.5z"/>
  </svg>
);

const SaveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <path d="M17 21v-8H7v8M7 3v5h8"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
  </svg>
);

/**
 * Compute the dropdown option for a given adapter id. Returns:
 *   { value: <id>, label: <display> }
 * where:
 *   - built-ins: id matches the built-in
 *   - "新增" (add-new): a special pseudo-id we'll never persist
 *   - user-custom: id is the user-typed id, label includes a tiny
 *     (user) marker so they know it's not built-in
 */
function providerOption(p: { id: string; name: string }, isBuiltIn: boolean): { value: string; label: string } {
  if (isBuiltIn) {
    const builtin = BUILTIN_PRESETS[p.id];
    return { value: p.id, label: builtin?.label ?? p.name };
  }
  return { value: p.id, label: `${p.name} (user)` };
}

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [verifiedAdapter, setVerifiedAdapter] = useState<string | null>(null);

  // Custom provider state.
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  // Add-form fields.
  const [newName, setNewName] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const [newDefaultModel, setNewDefaultModel] = useState('');
  const [addingError, setAddingError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Active provider form state.
  const [provider, setProvider] = useState<string>('local-keyword');
  const [model, setModel] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState(false);
  const [configFile, setConfigFile] = useState<string>('');

  // Load everything when modal opens.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setSavedAt(null);
    setVerifiedAdapter(null);
    setShowAddForm(false);
    setNewName('');
    setNewBaseUrl('');
    setNewDefaultModel('');
    setAddingError(null);

    Promise.all([
      fetch('/api/config', { cache: 'no-store' }).then((r) => r.json() as Promise<ConfigResponse>),
      fetch('/api/custom-providers', { cache: 'no-store' }).then((r) => r.json() as Promise<{ providers: CustomProvider[] }>),
    ])
      .then(([configData, cpData]) => {
        if (configData.error) throw new Error(configData.error);
        const cfg = configData.config || {};
        setConfigFile(configData.file || '');
        setCustomProviders(cpData.providers ?? []);

        const adapter = cfg['ai.adapter'] || 'local-keyword';
        setProvider(adapter);
        const isBuiltIn = !!BUILTIN_PRESETS[adapter];
        const customMatch = !isBuiltIn ? cpData.providers?.find((p) => p.id === adapter) : undefined;
        const preset = isBuiltIn ? BUILTIN_PRESETS[adapter] : customMatch;
        setModel(cfg['ai.model'] || preset?.defaultModel || '');
        setBaseUrl(cfg['ai.base_url'] || preset?.baseUrl || '');
        setApiKey(cfg['ai.api_key'] || '');
      })
      .catch((e) => setError(e.message || 'failed to load config'))
      .finally(() => setLoading(false));
  }, [open]);

  function onProviderChange(next: string) {
    if (next === '__add_new__') {
      setShowAddForm(true);
      return;
    }
    setShowAddForm(false);
    setProvider(next);
    const isBuiltIn = !!BUILTIN_PRESETS[next];
    const customMatch = !isBuiltIn ? customProviders.find((p) => p.id === next) : undefined;
    const preset = isBuiltIn ? BUILTIN_PRESETS[next] : customMatch;
    if (preset) {
      if (!model) setModel(preset.defaultModel);
      if (!baseUrl) setBaseUrl(preset.baseUrl);
    }
  }

  async function addCustomProvider() {
    const name = newName.trim();
    if (!name) {
      setAddingError('name required');
      return;
    }
    if (!newBaseUrl.trim()) {
      setAddingError('base URL required');
      return;
    }
    setAdding(true);
    setAddingError(null);
    try {
      const r = await fetch('/api/custom-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: name,
          name,
          baseUrl: newBaseUrl.trim(),
          defaultModel: newDefaultModel.trim() || undefined,
        }),
      });
      const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
      if (!r.ok) throw new Error(j.error || r.statusText);
      // Refresh the list and select the new one.
      const list = await fetch('/api/custom-providers', { cache: 'no-store' }).then((rr) => rr.json());
      setCustomProviders(list.providers ?? []);
      setShowAddForm(false);
      setNewName('');
      setNewBaseUrl('');
      setNewDefaultModel('');
      // Switch to the just-added provider.
      const addedId = j.provider?.id ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      setProvider(addedId);
      // Pre-fill baseUrl / model from the new provider's defaults.
      const added = (list.providers ?? []).find((p: CustomProvider) => p.id === addedId);
      if (added) {
        setBaseUrl(added.baseUrl);
        if (added.defaultModel) setModel(added.defaultModel);
      }
    } catch (e) {
      setAddingError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function removeCustomProvider(id: string) {
    if (!confirm(`Remove custom provider "${id}"?`)) return;
    try {
      const r = await fetch(`/api/custom-providers?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
      if (!r.ok) throw new Error(j.error || r.statusText);
      const list = await fetch('/api/custom-providers', { cache: 'no-store' }).then((rr) => rr.json());
      setCustomProviders(list.providers ?? []);
      if (provider === id) {
        setProvider('local-keyword');
        setBaseUrl('');
        setModel('');
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSavedAt(null);
    setVerifiedAdapter(null);
    try {
      const sets: Array<{ key: string; value: string }> = [];
      const deletes: string[] = [];

      // ai.adapter = the selected id (built-in OR user-custom).
      sets.push({ key: 'ai.adapter', value: provider });
      // ai.custom_provider_name was a temporary shim — clean it up.
      deletes.push('ai.custom_provider_name');

      if (model) sets.push({ key: 'ai.model', value: model });
      else deletes.push('ai.model');

      const preset = BUILTIN_PRESETS[provider];
      const custom = !preset ? customProviders.find((p) => p.id === provider) : undefined;
      const defaultBaseUrl = preset?.defaultBaseUrl ?? custom?.baseUrl ?? '';
      if (baseUrl && baseUrl !== defaultBaseUrl) {
        sets.push({ key: 'ai.base_url', value: baseUrl });
      } else if (baseUrl === defaultBaseUrl) {
        deletes.push('ai.base_url');
      }

      if (apiKey) sets.push({ key: 'ai.api_key', value: apiKey });
      else deletes.push('ai.api_key');

      const NEEDS_TEST_KEYS = new Set(['ai.adapter', 'ai.api_key', 'ai.base_url']);
      const needsTest =
        sets.some((s) => NEEDS_TEST_KEYS.has(s.key)) ||
        deletes.some((k) => NEEDS_TEST_KEYS.has(k));

      const r = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: { sets, deletes, withTest: needsTest } }),
      });
      const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
      if (!r.ok) throw new Error(j.error || r.statusText);
      if (j.rolledBack) {
        throw new Error(`保存后验证失败: ${j.error || 'unknown'}`);
      }
      if (needsTest) {
        setVerifiedAdapter(j.adapter ?? 'unknown');
      }
      setSavedAt(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function clearAll() {
    if (!confirm(`Clear all LintAny settings from ${configFile || '~/.checkit/config.json'}?`)) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deletes: ['ai.adapter', 'ai.model', 'ai.api_key', 'ai.base_url', 'ai.custom_provider_name'],
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setProvider('local-keyword');
      setModel('');
      setBaseUrl('');
      setApiKey('');
      setSavedAt(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  // Build the dropdown options: built-ins + custom + a separator + the
  // "新增" pseudo-option.
  const builtInOptions = Object.entries(BUILTIN_PRESETS).map(([id, p]) => ({ value: id, label: p.label }));
  const customOptions = customProviders.map((p) => ({ value: p.id, label: `${p.name} (user)` }));
  const dropdownValue = showAddForm ? '__add_new__' : provider;

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="LintAny 系统设置" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <header className="settings-head">
          <div className="settings-head-left">
            <span className="settings-head-icon"><KeyIcon /></span>
            <div>
              <h2 className="settings-title">LLM 供应商设置</h2>
              <p className="settings-sub">用于 <code>lintany chat</code> + Desktop Chat。改动同步到 <code>{configFile || '~/.checkit/config.json'}</code>。</p>
            </div>
          </div>
          <button type="button" className="settings-close" aria-label="关闭" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>

        {loading && <p className="settings-loading">加载中…</p>}

        {!loading && (
          <div className="settings-body">
            <label className="settings-field">
              <span className="settings-label">Provider</span>
              <select
                className="settings-input"
                value={dropdownValue}
                onChange={(e) => onProviderChange(e.target.value)}
              >
                {builtInOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
                {customOptions.length > 0 && (
                  <optgroup label="— 你的供应商 —">
                    {customOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </optgroup>
                )}
                <option value="__add_new__">+ 新增 (Add a new provider)</option>
              </select>
            </label>

            {showAddForm && (
              <div className="settings-addform">
                <p className="settings-hint" style={{ marginTop: 0 }}>
                  填好点「保存到列表」会立刻出现在下拉里,跟内置的供应商一样。
                </p>
                <label className="settings-field">
                  <span className="settings-label">供应商名称</span>
                  <input
                    className="settings-input"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="例如: DeepSeek / 豆包 / Moonshot / Qwen"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-label">Base URL (OpenAI-compatible 风格)</span>
                  <input
                    className="settings-input"
                    type="text"
                    value={newBaseUrl}
                    onChange={(e) => setNewBaseUrl(e.target.value)}
                    placeholder="https://api.example.com/v1"
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-label">默认模型 (可选)</span>
                  <input
                    className="settings-input"
                    type="text"
                    value={newDefaultModel}
                    onChange={(e) => setNewDefaultModel(e.target.value)}
                    placeholder="留空则用户每次自己填"
                  />
                </label>
                {addingError && <div className="settings-error">⚠ {addingError}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={addCustomProvider}
                    disabled={adding}
                  >
                    <PlusIcon />
                    <span style={{ marginLeft: 6 }}>{adding ? '保存中…' : '保存到列表'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => { setShowAddForm(false); setAddingError(null); }}
                    disabled={adding}
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* Show "remove" button for the currently selected custom provider. */}
            {!showAddForm && provider && !BUILTIN_PRESETS[provider] && customProviders.find((p) => p.id === provider) && (
              <div className="settings-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>当前选中 <code>{provider}</code> 是你定义的供应商。</span>
                <button
                  type="button"
                  className="settings-key-toggle"
                  onClick={() => removeCustomProvider(provider)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <TrashIcon /> 移除
                </button>
              </div>
            )}

            <label className="settings-field">
              <span className="settings-label">
                Model
                {BUILTIN_PRESETS[provider] && model === BUILTIN_PRESETS[provider].defaultModel && (
                  <span className="settings-default">默认</span>
                )}
              </span>
              <input
                className="settings-input"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="gpt-4o-mini / claude-sonnet-4-5 / MiniMax-M3 / 自定义模型名"
              />
            </label>

            {provider !== 'local-keyword' && (
              <>
                <label className="settings-field">
                  <span className="settings-label">
                    Base URL
                    {(() => {
                      const preset = BUILTIN_PRESETS[provider];
                      const custom = !preset ? customProviders.find((p) => p.id === provider) : undefined;
                      const defaultBaseUrl = preset?.defaultBaseUrl ?? custom?.baseUrl ?? '';
                      return baseUrl === defaultBaseUrl && baseUrl ? <span className="settings-default">默认</span> : null;
                    })()}
                  </span>
                  <input
                    className="settings-input"
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://api.example.com/v1"
                  />
                  <span className="settings-hint">OpenAI-compatible 用 <code>/v1</code> 结尾;Azure/Together 也兼容。</span>
                </label>

                <label className="settings-field">
                  <span className="settings-label">API Key</span>
                  <div className="settings-key-row">
                    <input
                      className="settings-input"
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={apiKey ? '••••••• (留空保持不变)' : 'sk-... / sk-ant-... / sk-cp-...'}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      className="settings-key-toggle"
                      onClick={() => setShowKey((s) => !s)}
                      aria-label={showKey ? '隐藏 API key' : '显示 API key'}
                    >
                      {showKey ? '隐藏' : '显示'}
                    </button>
                  </div>
                  <span className="settings-hint">
                    {apiKey
                      ? `当前已配置。留空保存不会清除已有 key。`
                      : `未配置。设置后所有 LLM 调用将走此 key。`}
                  </span>
                </label>
              </>
            )}

            {provider === 'local-keyword' && (
              <p className="settings-info">
                Local keyword 模式不需要 API key —— 关键词命中返回 rule/preset 推荐。要真 LLM 回复请选 OpenAI / Claude / MiniMax / Ollama 之一,或「新增」你自己的。
              </p>
            )}

            {error && <div className="settings-error">⚠ {error}</div>}
            {!error && savedAt && (
              <div className="settings-success">
                ✓ 已保存到 {configFile || '~/.checkit/config.json'}
                {verifiedAdapter && verifiedAdapter !== 'local-keyword' && (
                  <> · 已验证 <code>{verifiedAdapter}</code> 可达</>
                )}
                {verifiedAdapter === 'local-keyword' && (
                  <> · local-keyword 无需验证</>
                )}
              </div>
            )}
          </div>
        )}

        <footer className="settings-foot">
          <button type="button" className="btn btn-ghost" onClick={clearAll} disabled={saving || loading}>
            清空所有
          </button>
          <div className="settings-foot-right">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              取消
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving || loading}>
              <SaveIcon />
              <span style={{ marginLeft: 6 }}>{saving ? '保存中…' : '保存'}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
