'use client';
// Shell — the single top-level chrome of the SPA.
//
// Renders ONCE (mounted by SpApp, not per-route). Children are the active
// <Routes> subtree, which swaps the inner view component on URL change.
//
// Routing integration:
//   - Active rail tab is derived from useLocation().pathname.
//   - data-view on <main> reflects the active sub-route
//     (rule-detail on /rules/:ruleId, ai-fix on /ai-fix/:file/:idx, etc.).
//   - Tab clicks call useNavigate() to push a path.
//
// Project name (brand-sub):
//   - Reads `checkit:last-report` from localStorage and listens for
//     `checkit:report-changed` events (dispatched by DashboardView after
//     a successful scan / import). This replaces the old per-view `<Shell
//     repo=...>` prop pattern — there is no inner Shell anymore.
//
// Has no `view` / `onNavigate` / `repo` props. The view identifier is
// derived from URL, not passed in.

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SettingsModal } from './SettingsModal';

const Icon = ({ children, size = 18 }: { children: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

const ICON_SHIELD    = <Icon><path d="m9 12 2 2 4-4"/></Icon>;
const ICON_DASHBOARD = <Icon><circle cx="12" cy="12" r="9"/><path d="M12 12 16 8"/><path d="M12 3v3 M12 18v3 M3 12h3 M18 12h3"/></Icon>;
const ICON_GRID      = <Icon><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></Icon>;
const ICON_CHAT      = <Icon><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></Icon>;
const ICON_SETTINGS  = <Icon><path d="M4 6h16M4 12h16M4 18h10"/></Icon>;
const ICON_SUN       = <Icon><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l-1.41-1.41"/></Icon>;
const ICON_PRESET    = <Icon><path d="M4 6h16v4H4zM4 14h10v6H4zM16 14h4v6h-4z"/></Icon>;
const ICON_WORKSPACE = <Icon><path d="M3 7h18v10H3zM3 7l9-4 9 4M7 11h2v2H7zM11 11h2v2h-2zM15 11h2v2h-2z"/></Icon>;

type RailTabId = 'dashboard' | 'rules' | 'presets' | 'workspaces' | 'chat';

const RAIL_TABS: Array<{ id: RailTabId; path: string; label: string }> = [
  { id: 'dashboard',  path: '/',           label: '主控台' },
  { id: 'rules',      path: '/rules',      label: '规则市场' },
  { id: 'presets',    path: '/presets',    label: 'Preset' },
  { id: 'workspaces', path: '/workspaces', label: 'Workspace' },
  { id: 'chat',       path: '/chat',       label: 'Chat' },
];

const ICON_BY_TAB: Record<RailTabId, React.ReactNode> = {
  dashboard: ICON_DASHBOARD,
  rules: ICON_GRID,
  presets: ICON_PRESET,
  workspaces: ICON_WORKSPACE,
  chat: ICON_CHAT,
};

/**
 * Active rail tab from pathname. Sub-routes (rule-detail, ai-fix) belong to
 * their parent tab so the rail highlight stays stable while the <main>
 * content changes.
 */
function activeTabId(pathname: string): RailTabId {
  if (pathname === '/rules' || pathname.startsWith('/rules/')) return 'rules';
  if (pathname === '/chat' || pathname.startsWith('/ai-fix/')) return 'chat';
  if (pathname === '/presets') return 'presets';
  if (pathname === '/workspaces') return 'workspaces';
  return 'dashboard';
}

/**
 * data-view value for the current path. Distinguishes top-level tabs from
 * sub-routes (rule-detail on /rules/:ruleId, ai-fix on /ai-fix/:file/:idx).
 */
function dataViewFor(pathname: string): string {
  if (pathname === '/') return 'dashboard';
  if (pathname === '/rules') return 'rules';
  if (pathname.startsWith('/rules/')) return 'rule-detail';
  if (pathname === '/chat') return 'chat';
  if (pathname.startsWith('/ai-fix/')) return 'ai-fix';
  if (pathname === '/presets') return 'presets';
  if (pathname === '/workspaces') return 'workspaces';
  return 'dashboard';
}

const REPORT_STORAGE_KEY = 'checkit:last-report';

function readRepoFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(REPORT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.source === 'string' ? parsed.source : null;
  } catch {
    return null;
  }
}

export function Shell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = activeTabId(location.pathname);
  const viewId = dataViewFor(location.pathname);

  const [repo, setRepo] = useState<string | null>(() => readRepoFromStorage());

  useEffect(() => {
    const handler = () => setRepo(readRepoFromStorage());
    // Cross-tab (storage event) — keeps multiple windows in sync.
    window.addEventListener('storage', handler);
    // Same-tab (DashboardView dispatches after persist()).
    window.addEventListener('checkit:report-changed', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('checkit:report-changed', handler);
    };
  }, []);

  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <header className="topbar">
        <div
          className="brand rail-brand"
          role="button"
          tabIndex={0}
          aria-label="返回首页"
          data-testid="rail-brand"
          onClick={() => navigate('/')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/'); }}
        >
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
        <nav className="rail-tabs" aria-label="主标签">
          {RAIL_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`rail-tab ${activeTab === t.id ? 'active' : ''}`}
              title={t.label}
              aria-label={t.label}
              aria-current={activeTab === t.id ? 'page' : undefined}
              onClick={() => navigate(t.path)}
              data-testid={`rail-tab-${t.id}`}
            >
              {ICON_BY_TAB[t.id]}
            </button>
          ))}
        </nav>
        <div className="rail-actions">
          <button
            className="rail-icon"
            type="button"
            aria-label="设置"
            title="设置 LLM 供应商 / API key / 模型"
            data-testid="rail-icon-settings"
            onClick={() => setSettingsOpen(true)}
          >{ICON_SETTINGS}</button>
        </div>
      </aside>
      <main data-view={viewId} data-testid={`view-${viewId}`}>{children}</main>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
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
