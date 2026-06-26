'use client';
// The SPA entry. Strict react-router BrowserRouter architecture.
//
// Architecture:
//   <BrowserRouter>     ← URL is observable (window.location.pathname); routing
//                          primitives (Routes, Route, useNavigate, useParams)
//     <Shell>           ← renders ONCE per app lifetime (topbar + rail + <main>)
//       <Routes>        ← swaps only the <main> child based on URL
//         <Route ... /> ← each route element is a view component (no Shell inside)
//       </Routes>
//     </Shell>
//   </BrowserRouter>
//
// Each view component:
//   - Has no `navigate` prop, no inner `<Shell>`.
//   - Uses `useNavigate()` / `useParams()` from react-router directly.
//   - Renders ONLY its own content; the surrounding chrome is Shell's job.
//
// URL is the single source of truth for "where am I". No localStorage view
// state. No in-house ViewState registry. Navigation is via real react-router
// primitives.
//
// Why BrowserRouter (not MemoryRouter or HashRouter):
// - MemoryRouter never touches window.location, so the URL is stale from the
//   test/browser's perspective and we can't observe navigation, share links,
//   or wait for URL transitions in e2e tests.
// - HashRouter would work but produces ugly `/#/path` URLs and complicates
//   tests (every page.goto needs `/` + `#` + path).
// - BrowserRouter gives us clean `/rules/:ruleId` URLs and updates
//   window.location.pathname on every navigation. Back/forward works.
// - For dev/tests: Next.js [...slug] catch-all route serves the SPA at any
//   path, so the router can take over. For packaged Electron production:
//   a custom protocol handler serves index.html for all routes — out of
//   scope here.
// - Both BrowserRouter and HashRouter touch `window.document` during render;
//   that's why SpApp is loaded with `next/dynamic({ ssr: false })` in
//   page.tsx — it only mounts client-side.

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Shell } from './components/Shell';
import { DashboardView } from './views/DashboardView';
import { RulesView } from './views/RulesView';
import { RuleDetailView } from './views/RuleDetailView';
import { ChatView } from './views/ChatView';
import { AiFixView } from './views/AiFixView';
import { PresetView } from './views/PresetView';
import { WorkspaceView } from './views/WorkspaceView';

export function SpApp() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<DashboardView />} />
          <Route path="/rules" element={<RulesView />} />
          <Route path="/rules/:ruleId" element={<RuleDetailView />} />
          <Route path="/chat" element={<ChatView />} />
          <Route path="/ai-fix/:file/:idx" element={<AiFixView />} />
          <Route path="/presets" element={<PresetView />} />
          <Route path="/workspaces" element={<WorkspaceView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}
