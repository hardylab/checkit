'use client';
import React from 'react';
import { type ViewId, type ViewState, RAIL_TABS } from '../views/registry';

const Icon = ({ children, size = 18 }: { children: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

const ICON_SHIELD    = <Icon><path d="M12 2.5 4.5 5.5v6c0 5 3.2 9.4 7.5 10.5 4.3-1.1 7.5-5.5 7.5-10.5v-6L12 2.5Z"/><path d="m9 12 2 2 4-4"/></Icon>;
const ICON_DASHBOARD = <Icon><circle cx="12" cy="12" r="9"/><path d="M12 12 16 8"/><path d="M12 3v3 M12 18v3 M3 12h3 M18 12h3"/></Icon>;
const ICON_GRID      = <Icon><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></Icon>;
const ICON_CHAT      = <Icon><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></Icon>;
const ICON_SETTINGS  = <Icon><path d="M4 6h16M4 12h16M4 18h10"/></Icon>;
const ICON_SUN       = <Icon><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></Icon>;

const ICON_BY_TAB: Record<string, React.ReactNode> = {
  dashboard: ICON_DASHBOARD,
  rules: ICON_GRID,
  chat: ICON_CHAT,
};

// Maps a view id to which rail tab should be highlighted.
// `rule-detail` and `ai-fix` are sub-views of their parent tab.
function parentTabId(id: ViewId): 'dashboard' | 'rules' | 'chat' {
  if (id === 'rules' || id === 'rule-detail') return 'rules';
  if (id === 'chat') return 'chat';
  return 'dashboard';
}

export function Shell({
  repo,
  view,
  onNavigate,
  children,
}: {
  repo?: string;
  view: ViewId | ViewState;
  onNavigate: (next: ViewState) => void;
  children: React.ReactNode;
}) {
  const viewId: ViewId = typeof view === 'string' ? view : view.id;
  const activeTab = parentTabId(viewId);

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brand-logo" aria-hidden>{ICON_SHIELD}</div>
          <div className="brand-text">
            <div className="brand-title">Checkit Codebase Doctor</div>
            <div className="brand-sub">
              <span className="branch-dot" />
              <span>{repo ?? 'no project loaded'}</span>
            </div>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-ghost" type="button">重新扫描</button>
          <button className="btn btn-ghost" type="button" aria-label="切换主题">{ICON_SUN}</button>
        </div>
      </header>
      <aside className="rail" aria-label="主导航">
        <button
          type="button"
          className="rail-brand"
          aria-label="Checkit Codebase Doctor"
          onClick={() => onNavigate({ id: 'dashboard' })}
        >{ICON_SHIELD}</button>
        <nav className="rail-tabs" aria-label="主标签">
          {RAIL_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`rail-tab ${activeTab === t.id ? 'active' : ''}`}
              title={t.label}
              aria-label={t.label}
              aria-current={activeTab === t.id ? 'page' : undefined}
              onClick={() => onNavigate(t.view)}
              data-testid={`rail-tab-${t.id}`}
            >
              {ICON_BY_TAB[t.id]}
            </button>
          ))}
        </nav>
        <div className="rail-actions">
          <button className="rail-icon" type="button" aria-label="设置" title="设置">{ICON_SETTINGS}</button>
        </div>
      </aside>
      <main data-view={viewId} data-testid={`view-${viewId}`}>{children}</main>
    </>
  );
}

export function LoadingOverlay({ text = 'Scanning…' }: { text?: string }) {
  return (
    <div className="loading-overlay">
      <div className="loading-card">
        <div className="spinner" />
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>{text}</div>
      </div>
    </div>
  );
}
