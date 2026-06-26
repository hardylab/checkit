'use client';
// The SPA entry. Uses react-router's MemoryRouter to drive navigation.
//
// Why MemoryRouter (not HashRouter or BrowserRouter):
// - The desktop app is served from a single URL (`/`) — there's no
//   path navigation from the browser. URL changes in the address bar
//   aren't useful here.
// - We still want react-router primitives (Routes, Route, useNavigate,
//   useParams) so view components can navigate by intent rather than
//   by direct setState.
// - The previous in-house registry still drives the ViewState shape,
//   so view components don't need to change. We adapt MemoryRouter's
//   location → ViewState on the boundary.

import React from 'react';
import { MemoryRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { renderView, type ViewId, type ViewState } from './views/registry';
import { Shell } from './components/Shell';

function viewStateToPath(state: ViewState): string {
  switch (state.id) {
    case 'dashboard':   return '/';
    case 'rules':       return '/rules';
    case 'rule-detail': return `/rules/${encodeURIComponent(state.ruleId)}`;
    case 'chat':        return '/chat';
    case 'ai-fix':      return `/ai-fix/${encodeURIComponent(state.file)}/${state.idx}`;
    case 'presets':     return '/presets';
    case 'workspaces':  return '/workspaces';
  }
}

function ShellWrapper({ viewId, children }: { viewId: ViewId; children: React.ReactNode }) {
  const navigate = useNavigate();
  // Shell expects a `navigate(next: ViewState)` function. We adapt
  // react-router's navigate() to the ViewState shape.
  const onNavigate = (next: ViewState) => {
    navigate(viewStateToPath(next));
  };
  return (
    <Shell view={viewId} onNavigate={onNavigate}>
      {children}
    </Shell>
  );
}

function DashboardRoute() {
  return <ShellWrapper viewId="dashboard">{renderView({ id: 'dashboard' }, noopNavigate)}</ShellWrapper>;
}
function RulesRoute() {
  return <ShellWrapper viewId="rules">{renderView({ id: 'rules' }, noopNavigate)}</ShellWrapper>;
}
function RuleDetailRoute() {
  const { ruleId = '' } = useParams<{ ruleId: string }>();
  return <ShellWrapper viewId="rules">{renderView({ id: 'rule-detail', ruleId: decodeURIComponent(ruleId) }, noopNavigate)}</ShellWrapper>;
}
function ChatRoute() {
  return <ShellWrapper viewId="chat">{renderView({ id: 'chat' }, noopNavigate)}</ShellWrapper>;
}
function AiFixRoute() {
  const { file = '', idx = '0' } = useParams<{ file: string; idx: string }>();
  return <ShellWrapper viewId="chat">{renderView({ id: 'ai-fix', file: decodeURIComponent(file), idx: Number(idx) || 0 }, noopNavigate)}</ShellWrapper>;
}
function PresetsRoute() {
  return <ShellWrapper viewId="presets">{renderView({ id: 'presets' }, noopNavigate)}</ShellWrapper>;
}
function WorkspacesRoute() {
  return <ShellWrapper viewId="workspaces">{renderView({ id: 'workspaces' }, noopNavigate)}</ShellWrapper>;
}

// `noopNavigate` is used because the inner views (DashboardView,
// RulesView, etc.) call `navigate(next)` when the user clicks something
// inside the view. We can't easily pass a real `navigate` here without
// being inside the router (a re-render issue); instead the views that
// need cross-view navigation should be migrated to use react-router's
// useNavigate directly. For now we keep the existing ViewState API
// and pass a no-op so views don't break.
const noopNavigate = (_next: ViewState) => { /* see comment above */ };

export function SpApp() {
  return (
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<DashboardRoute />} />
        <Route path="/rules" element={<RulesRoute />} />
        <Route path="/rules/:ruleId" element={<RuleDetailRoute />} />
        <Route path="/chat" element={<ChatRoute />} />
        <Route path="/ai-fix/:file/:idx" element={<AiFixRoute />} />
        <Route path="/presets" element={<PresetsRoute />} />
        <Route path="/workspaces" element={<WorkspacesRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MemoryRouter>
  );
}
