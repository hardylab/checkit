'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Shell } from '../components/Shell';
import type { RuleSet } from '../lib/rule-sets';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  recs?: Array<{ id: string; title: string; severity: string; tldr: string }>;
  setRecs?: RuleSet[];
};

const STORAGE_KEY = 'checkit:chat-history';
const INSTALLED_KEY = 'checkit:installed-rules';
const INSTALLED_SETS_KEY = 'checkit:installed-sets';

const SUGGESTIONS = [
  '我想加强 SQL 注入检查',
  '扫描项目里硬编码的密钥和凭证',
  'TypeScript 项目里怎么防止 any 类型泛滥',
  '我们团队没有 ESLint 规则集,帮我配一套',
];

const QUICK_KEYS = ['SQL', '密钥', 'TypeScript', '依赖', '测试', '文件', '架构', 'console.log'];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [installedRules, setInstalledRules] = useState<Set<string>>(new Set());
  const [installedSets, setInstalledSets] = useState<Set<string>>(new Set());
  const scrollerRef = useRef<HTMLDivElement>(null);

  const [hydrated, setHydrated] = useState(false);

  // Restore history + installed list
  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) setMessages(JSON.parse(s));
    } catch {}
    try {
      const s = localStorage.getItem(INSTALLED_KEY);
      if (s) {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) setInstalledRules(new Set(arr));
      }
    } catch {}
    try {
      const s = localStorage.getItem(INSTALLED_SETS_KEY);
      if (s) {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) setInstalledSets(new Set(arr));
      }
    } catch {}
    setHydrated(true);
  }, []);

  // Persist + scroll — only after hydration so we don't clobber stored state.
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50))); } catch {}
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages, hydrated]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput('');
    setSending(true);
    const userMsg: Message = { id: `${Date.now()}-u`, role: 'user', text: trimmed };
    setMessages((m) => [...m, userMsg]);
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history: messages.slice(-20) }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const aiMsg: Message = {
        id: `${Date.now()}-a`,
        role: 'assistant',
        text: data.reply,
        recs: data.recommendations,
        setRecs: data.recommendedSets,
      };
      setMessages((m) => [...m, aiMsg]);
    } catch (e: any) {
      setMessages((m) => [...m, {
        id: `${Date.now()}-e`, role: 'assistant',
        text: `出错了: ${e.message ?? e}`,
      }]);
    } finally {
      setSending(false);
    }
  };

  const installRule = (id: string) => {
    const next = new Set(installedRules);
    next.add(id);
    setInstalledRules(next);
    try { localStorage.setItem(INSTALLED_KEY, JSON.stringify([...next])); } catch {}
  };

  const uninstallRule = (id: string) => {
    const next = new Set(installedRules);
    next.delete(id);
    setInstalledRules(next);
    try { localStorage.setItem(INSTALLED_KEY, JSON.stringify([...next])); } catch {}
  };

  const installSet = (set: RuleSet) => {
    const next = new Set(installedSets);
    next.add(set.id);
    setInstalledSets(next);
    try { localStorage.setItem(INSTALLED_SETS_KEY, JSON.stringify([...next])); } catch {}
    // Also flip individual rule ids
    const nextRules = new Set(installedRules);
    for (const id of set.ruleIds) nextRules.add(id);
    setInstalledRules(nextRules);
    try { localStorage.setItem(INSTALLED_KEY, JSON.stringify([...nextRules])); } catch {}
  };

  const uninstallSet = (set: RuleSet) => {
    const next = new Set(installedSets);
    next.delete(set.id);
    setInstalledSets(next);
    try { localStorage.setItem(INSTALLED_SETS_KEY, JSON.stringify([...next])); } catch {}
    const nextRules = new Set(installedRules);
    for (const id of set.ruleIds) nextRules.delete(id);
    setInstalledRules(nextRules);
    try { localStorage.setItem(INSTALLED_KEY, JSON.stringify([...nextRules])); } catch {}
  };

  const clearHistory = () => {
    if (!confirm('清空所有对话?')) return;
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return (
    <Shell repo="chat">
      <div className="chat-page">
        <div className="chat-container">
          <header className="chat-header">
            <div>
              <h1 className="chat-title">AI 规则助手</h1>
              <p className="chat-subtitle">
                用自然语言描述你的需求,我会从市场匹配规则或生成新规则。
              </p>
            </div>
            <button className="btn btn-ghost" type="button" onClick={clearHistory}>清空对话</button>
          </header>

          <div className="chat-thread" ref={scrollerRef}>
            {messages.length === 0 ? (
              <div className="chat-empty">
                <div className="chat-empty-icon">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                </div>
                <h2>告诉我你想加强什么</h2>
                <p>我用关键词(SQL、XSS、密钥、性能、依赖、TS、协作…)从市场匹配规则。也可以直接发「我想做 X」自由描述。</p>
                <div className="chat-suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} className="chat-suggestion" type="button" onClick={() => send(s)}>
                      {s}
                      <span className="chat-suggestion-arrow">→</span>
                    </button>
                  ))}
                </div>
                <div className="chat-quickkeys">
                  试试关键词:
                  {QUICK_KEYS.map((k) => (
                    <button key={k} className="chat-quickkey" type="button" onClick={() => send(k)}>{k}</button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`chat-message chat-message-${m.role}`}>
                  {m.role === 'assistant' && (
                    <div className="chat-avatar" aria-hidden>
                      <span className="chat-avatar-dot" />
                    </div>
                  )}
                  <div className="chat-bubble">
                    <div className="chat-bubble-text">{m.text}</div>
                    {m.recs && m.recs.length > 0 && (
                      <div className="chat-recs">
                        {m.recs.map((r) => {
                          const installed = installedRules.has(r.id);
                          return (
                            <div key={r.id} className="chat-rec-card">
                              <div className="chat-rec-head">
                                <code className="chat-rec-id">{r.id}</code>
                                <span className={`pill ${r.severity === 'error' ? 'pill-error' : r.severity === 'warning' ? 'pill-warn' : 'pill-accent'}`}>
                                  {r.severity === 'error' ? '严重' : r.severity === 'warning' ? '警告' : '提示'}
                                </span>
                              </div>
                              <div className="chat-rec-title">{r.title}</div>
                              <div className="chat-rec-tldr">{r.tldr}</div>
                              <div className="chat-rec-actions">
                                {installed ? (
                                  <>
                                    <span className="pill pill-success">✓ 已启用</span>
                                    <button className="btn btn-ghost" type="button" onClick={() => uninstallRule(r.id)}>停用</button>
                                  </>
                                ) : (
                                  <button className="btn btn-primary" type="button" onClick={() => installRule(r.id)}>
                                    + 一键启用
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {m.setRecs && m.setRecs.length > 0 && (
                      <div className="chat-recs">
                        {m.setRecs.map((s) => {
                          const installed = installedSets.has(s.id);
                          return (
                            <div key={s.id} className="chat-rec-card chat-rec-card-set" data-set-id={s.id}>
                              <div className="chat-rec-head">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{
                                    width: 28, height: 28,
                                    borderRadius: 'var(--r-sm)',
                                    background: 'var(--accent-soft)',
                                    color: 'var(--accent)',
                                    display: 'inline-grid', placeItems: 'center',
                                    fontSize: 12, fontWeight: 600,
                                  }}>{s.icon}</span>
                                  <code className="chat-rec-id">{s.id}</code>
                                </div>
                                <span className="pill pill-accent">{s.ruleIds.length} 条规则</span>
                              </div>
                              <div className="chat-rec-title">{s.name}</div>
                              <div className="chat-rec-tldr">{s.description}</div>
                              <div className="chat-rec-actions">
                                {installed ? (
                                  <>
                                    <span className="pill pill-success">✓ 已安装</span>
                                    <button className="btn btn-ghost" type="button" onClick={() => uninstallSet(s)}>停用</button>
                                  </>
                                ) : (
                                  <button className="btn btn-primary" type="button" onClick={() => installSet(s)}>
                                    + 整个安装
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {sending && (
              <div className="chat-message chat-message-assistant">
                <div className="chat-avatar" aria-hidden><span className="chat-avatar-dot" /></div>
                <div className="chat-bubble chat-bubble-typing">
                  <span className="chat-typing-dot" />
                  <span className="chat-typing-dot" />
                  <span className="chat-typing-dot" />
                </div>
              </div>
            )}
          </div>

          <div className="chat-composer">
            <input
              type="text"
              className="chat-input"
              placeholder="输入消息…(Enter 发送)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
              disabled={sending}
            />
            <button className="btn btn-primary chat-send" type="button" onClick={() => send(input)} disabled={sending || !input.trim()}>
              发送
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}