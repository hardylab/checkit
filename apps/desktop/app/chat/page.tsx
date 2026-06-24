'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Shell } from '../components/Shell';
import type { RuleSet } from '../lib/rule-sets';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  recs?: Array<{ id: string; title: string; severity: string; tldr: string }>;
  setRecs?: RuleSet[];
};

type Conversation = {
  id: string;
  title: string;          // 显示在侧边栏,默认取首条用户消息前 24 字
  createdAt: number;
  updatedAt: number;
  messages: Message[];
};

const CONVOS_KEY = 'checkit:chat-conversations';
const ACTIVE_KEY = 'checkit:chat-active';
// 旧版单数组 key,首次加载时迁移
const LEGACY_KEY = 'checkit:chat-history';

const INSTALLED_KEY = 'checkit:installed-rules';
const INSTALLED_SETS_KEY = 'checkit:installed-sets';

const SUGGESTIONS = [
  '我想加强 SQL 注入检查',
  '扫描项目里硬编码的密钥和凭证',
  'TypeScript 项目里怎么防止 any 类型泛滥',
  '我们团队没有 ESLint 规则集,帮我配一套',
];

const QUICK_KEYS = ['SQL', '密钥', 'TypeScript', '依赖', '测试', '文件', '架构', 'console.log'];

const MAX_CONVOS = 50;          // 最多保留多少条会话
const MAX_MESSAGES_PER = 200;   // 单会话消息上限

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const deriveTitle = (messages: Message[]): string => {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return '新对话';
  const t = firstUser.text.trim().replace(/\s+/g, ' ');
  return t.length > 24 ? t.slice(0, 24) + '…' : t;
};

const fmtRelative = (ts: number): string => {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} 天前`;
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
};

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [installedRules, setInstalledRules] = useState<Set<string>>(new Set());
  const [installedSets, setInstalledSets] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // ── Hydrate ─────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CONVOS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setConversations(arr);
      } else {
        // 一次性迁移:旧 messages 数组 → 一个会话
        const legacy = localStorage.getItem(LEGACY_KEY);
        if (legacy) {
          const msgs = JSON.parse(legacy);
          if (Array.isArray(msgs) && msgs.length > 0) {
            const conv: Conversation = {
              id: newId(),
              title: deriveTitle(msgs),
              createdAt: Date.now(),
              updatedAt: Date.now(),
              messages: msgs,
            };
            setConversations([conv]);
            setActiveId(conv.id);
          }
        }
      }
      const a = localStorage.getItem(ACTIVE_KEY);
      if (a) setActiveId(a);
    } catch {}
    try {
      const s = localStorage.getItem(INSTALLED_KEY);
      if (s) { const a = JSON.parse(s); if (Array.isArray(a)) setInstalledRules(new Set(a)); }
    } catch {}
    try {
      const s = localStorage.getItem(INSTALLED_SETS_KEY);
      if (s) { const a = JSON.parse(s); if (Array.isArray(a)) setInstalledSets(new Set(a)); }
    } catch {}
    setHydrated(true);
  }, []);

  // ── Persist ─────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    try {
      const trimmed = conversations
        .slice(-MAX_CONVOS)
        .map((c) => ({ ...c, messages: c.messages.slice(-MAX_MESSAGES_PER) }));
      localStorage.setItem(CONVOS_KEY, JSON.stringify(trimmed));
    } catch {}
  }, [conversations, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {}
  }, [activeId, hydrated]);

  // 清理旧 key(迁移成功后)
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.removeItem(LEGACY_KEY); } catch {}
  }, [hydrated]);

  // ── Derived ─────────────────────────────────────────────
  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );
  const activeMessages = active?.messages ?? [];

  // 切换会话时滚到底
  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [activeId, activeMessages.length]);

  // ── Actions ─────────────────────────────────────────────
  const newConversation = (): string => {
    const conv: Conversation = {
      id: newId(),
      title: '新对话',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    setConversations((cs) => [...cs, conv]);
    setActiveId(conv.id);
    return conv.id;
  };

  const openConversation = (id: string) => {
    if (id === activeId) return;
    setActiveId(id);
  };

  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('删除这个对话?')) return;
    setConversations((cs) => cs.filter((c) => c.id !== id));
    if (activeId === id) {
      // 切到列表里第一个,没有就建新的
      setConversations((cs) => {
        if (cs.length === 0) {
          const conv: Conversation = {
            id: newId(),
            title: '新对话',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: [],
          };
          setActiveId(conv.id);
          return [conv];
        }
        setActiveId(cs[0].id);
        return cs;
      });
    }
  };

  const updateActive = (mutator: (c: Conversation) => Conversation) => {
    if (!activeId) return;
    setConversations((cs) =>
      cs.map((c) => (c.id === activeId ? mutator(c) : c))
    );
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput('');

    // 没有活动会话就先建一个
    let targetId = activeId;
    if (!targetId) targetId = newConversation();

    setSending(true);
    const userMsg: Message = { id: newId(), role: 'user', text: trimmed };
    setConversations((cs) =>
      cs.map((c) => {
        if (c.id !== targetId) return c;
        const msgs = [...c.messages, userMsg];
        const isFirst = c.messages.length === 0;
        return {
          ...c,
          messages: msgs,
          title: isFirst ? deriveTitle(msgs) : c.title,
          updatedAt: Date.now(),
        };
      })
    );

    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: (conversations.find((c) => c.id === targetId)?.messages ?? []).slice(-20),
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const aiMsg: Message = {
        id: newId(),
        role: 'assistant',
        text: data.reply,
        recs: data.recommendations,
        setRecs: data.recommendedSets,
      };
      setConversations((cs) =>
        cs.map((c) =>
          c.id === targetId ? { ...c, messages: [...c.messages, aiMsg], updatedAt: Date.now() } : c
        )
      );
    } catch (e: any) {
      const errMsg: Message = {
        id: newId(),
        role: 'assistant',
        text: `出错了: ${e.message ?? e}`,
      };
      setConversations((cs) =>
        cs.map((c) =>
          c.id === targetId ? { ...c, messages: [...c.messages, errMsg], updatedAt: Date.now() } : c
        )
      );
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

  // ── Render ─────────────────────────────────────────────
  return (
    <Shell repo="chat">
      <div className="chat-page">
        {/* ── Side rail ─────────────────────────── */}
        <aside className="chat-side-rail" aria-label="对话历史">
          <div className="chat-side-eyebrow">对话</div>
          <div className="chat-side-new">
            <button
              type="button"
              className="chat-side-new-btn"
              onClick={newConversation}
              data-testid="chat-new"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              新建对话
            </button>
          </div>
          <nav className="chat-side-list" aria-label="会话列表">
            {conversations.length === 0 ? (
              <div className="chat-side-empty">还没有对话</div>
            ) : (
              [...conversations]
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((c) => {
                  const isActive = c.id === activeId;
                  return (
                    <div
                      key={c.id}
                      className={`chat-side-item ${isActive ? 'active' : ''}`}
                      onClick={() => openConversation(c.id)}
                      data-testid={`chat-item-${c.id}`}
                      data-active={isActive}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openConversation(c.id);
                        }
                      }}
                    >
                      <div className="chat-side-item-body">
                        <div className="chat-side-item-title">{c.title || '新对话'}</div>
                        <div className="chat-side-item-meta">
                          <span>{c.messages.length} 条消息</span>
                          <span className="sep">·</span>
                          <span>{fmtRelative(c.updatedAt)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="chat-side-item-del"
                        aria-label="删除对话"
                        onClick={(e) => deleteConversation(c.id, e)}
                        data-testid={`chat-del-${c.id}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        </svg>
                      </button>
                    </div>
                  );
                })
            )}
          </nav>
        </aside>

        {/* ── Conversation pane ───────────────────── */}
        <main className="chat-conversation">
          {!active ? (
            <div className="chat-empty">
              <div className="chat-empty-icon">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </div>
              <h2>开始一段新对话</h2>
              <p>用自然语言描述你的需求,我会从市场匹配规则或生成新规则。</p>
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
            <>
              <header className="chat-conv-head">
                <div className="chat-conv-head-text">
                  <div className="chat-conv-head-title">{active.title || '新对话'}</div>
                  <div className="chat-conv-head-sub">
                    {active.messages.length} 条消息 · {fmtRelative(active.updatedAt)}
                  </div>
                </div>
                {active.messages.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      if (!confirm('清空当前对话的消息?')) return;
                      updateActive((c) => ({ ...c, messages: [], updatedAt: Date.now(), title: '新对话' }));
                    }}
                  >
                    清空消息
                  </button>
                )}
              </header>

              <div className="chat-thread" ref={scrollerRef} data-testid="chat-thread">
                {active.messages.length === 0 ? (
                  <div className="chat-conv-empty">
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
                  </div>
                ) : (
                  active.messages.map((m) => (
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
            </>
          )}
        </main>
      </div>
    </Shell>
  );
}
