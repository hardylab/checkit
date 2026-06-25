'use client';
// SettingsModal — LintAny system settings dialog.
// Lets the user configure LLM provider, model, API key, and base URL.
// Settings persist to ~/.checkit/config.json (via POST /api/config).
// The same config is read by the CLI, so this is THE single source of truth
// for LLM credentials across both desktop and CLI.

import React, { useEffect, useState } from 'react';

interface ConfigResponse {
  config: Record<string, string>;
  file: string;
  error?: string;
}

const PROVIDER_PRESETS: Record<string, { defaultBaseUrl: string; defaultModel: string }> = {
  'local-keyword': { defaultBaseUrl: '', defaultModel: '(no LLM)' },
  openai:         { defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
  claude:         { defaultBaseUrl: 'https://api.anthropic.com', defaultModel: 'claude-sonnet-4-5' },
  minimax:        { defaultBaseUrl: 'https://api.minimaxi.com/v1', defaultModel: 'MiniMax-M3' },
  ollama:         { defaultBaseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3' },
};

const PROVIDER_OPTIONS = [
  { id: 'local-keyword', label: 'Local keyword (offline, no key)' },
  { id: 'openai',         label: 'OpenAI / Azure / Together / OpenRouter' },
  { id: 'claude',         label: 'Anthropic Claude' },
  { id: 'minimax',        label: 'MiniMax' },
  { id: 'ollama',         label: 'Ollama (local)' },
];

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

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Form state
  const [provider, setProvider] = useState<string>('local-keyword');
  const [model, setModel] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState(false);
  const [configFile, setConfigFile] = useState<string>('');

  // Load existing config when modal opens.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setSavedAt(null);
    fetch('/api/config', { cache: 'no-store' })
      .then((r) => r.json() as Promise<ConfigResponse>)
      .then((data) => {
        if (data.error) throw new Error(data.error);
        const cfg = data.config || {};
        setConfigFile(data.file || '');
        const adapter = cfg['ai.adapter'] || 'local-keyword';
        setProvider(adapter);
        // Auto-fill model + baseUrl from preset if user hasn't customized.
        const preset = PROVIDER_PRESETS[adapter];
        setModel(cfg['ai.model'] || preset?.defaultModel || '');
        setBaseUrl(cfg['ai.base_url'] || preset?.defaultBaseUrl || '');
        setApiKey(cfg['ai.api_key'] || '');
      })
      .catch((e) => setError(e.message || 'failed to load config'))
      .finally(() => setLoading(false));
  }, [open]);

  // When provider changes, suggest model + baseUrl (only if blank).
  function onProviderChange(next: string) {
    setProvider(next);
    const preset = PROVIDER_PRESETS[next];
    if (preset) {
      if (!model) setModel(preset.defaultModel);
      if (!baseUrl) setBaseUrl(preset.defaultBaseUrl);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const writes: Array<{ key: string; value: string }> = [];
      const deletes: string[] = [];

      // Compare against what we'd reset to (provider default) to detect
      // "user cleared this back to default" → unset.
      const preset = PROVIDER_PRESETS[provider];

      writes.push({ key: 'ai.adapter', value: provider });

      // Model: if user provided custom, set; if matches preset default, leave as-is.
      if (model) writes.push({ key: 'ai.model', value: model });
      else deletes.push('ai.model');

      // BaseUrl: if user provided, set; if matches preset default, leave as-is.
      if (baseUrl && baseUrl !== (preset?.defaultBaseUrl || '')) {
        writes.push({ key: 'ai.base_url', value: baseUrl });
      } else if (baseUrl === (preset?.defaultBaseUrl || '')) {
        // Empty means "use default" — explicitly unset to keep config clean.
        deletes.push('ai.base_url');
      }

      // API key: always write if non-empty (no preset default).
      if (apiKey) writes.push({ key: 'ai.api_key', value: apiKey });
      else deletes.push('ai.api_key');

      // POST each write. Keep simple — fire sequentially.
      for (const w of writes) {
        const r = await fetch('/api/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: w.key, value: w.value }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
          throw new Error(`set ${w.key}: ${j.error || r.statusText}`);
        }
      }
      for (const k of deletes) {
        const r = await fetch('/api/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deletes: [k] }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
          throw new Error(`unset ${k}: ${j.error || r.statusText}`);
        }
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
        body: JSON.stringify({ deletes: ['ai.adapter', 'ai.model', 'ai.api_key', 'ai.base_url'] }),
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

  const presetForProvider = PROVIDER_PRESETS[provider];

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
                value={provider}
                onChange={(e) => onProviderChange(e.target.value)}
              >
                {PROVIDER_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </label>

            <label className="settings-field">
              <span className="settings-label">
                Model
                {presetForProvider && model === presetForProvider.defaultModel && (
                  <span className="settings-default">默认</span>
                )}
              </span>
              <input
                className="settings-input"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={presetForProvider?.defaultModel || 'gpt-4o-mini / claude-sonnet-4-5 / MiniMax-M3'}
              />
            </label>

            {provider !== 'local-keyword' && (
              <>
                <label className="settings-field">
                  <span className="settings-label">
                    Base URL
                    {baseUrl === presetForProvider?.defaultBaseUrl && baseUrl && (
                      <span className="settings-default">默认</span>
                    )}
                  </span>
                  <input
                    className="settings-input"
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder={presetForProvider?.defaultBaseUrl || 'https://api.example.com/v1'}
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
                Local keyword 模式不需要 API key —— 关键词命中返回 rule/preset 推荐。要真 LLM 回复请选 OpenAI / Claude / MiniMax 之一。
              </p>
            )}

            {error && <div className="settings-error">⚠ {error}</div>}
            {!error && savedAt && (
              <div className="settings-success">✓ 已保存到 {configFile || '~/.checkit/config.json'}</div>
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
