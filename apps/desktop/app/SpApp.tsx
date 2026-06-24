'use client';
// The SPA entry. Hydrates the view state from localStorage and renders
// the current view. Lives in its own file so page.tsx can stay a server
// component (which fixes Next App Router's tendency to treat an empty
// client-component root as a 404).

import React, { useState, useEffect } from 'react';
import { renderView, type ViewState } from './views/registry';

const VIEW_KEY = 'checkit:view';

export function SpApp() {
  const [view, setView] = useState<ViewState>({ id: 'dashboard' });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VIEW_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.id === 'string') setView(parsed);
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch {}
  }, [view, hydrated]);

  if (!hydrated) {
    // Invisible placeholder during SSR + first paint. The Server Component
    // wrapper ensures the page tree is non-empty, so this is purely cosmetic.
    return <div style={{ visibility: 'hidden' }} />;
  }

  return <>{renderView(view, setView)}</>;
}
