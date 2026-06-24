'use client';
// Single SPA entry. All "routes" are in-memory view states — no URL changes.
import React, { useState, useEffect } from 'react';
import { renderView, type ViewState } from './views/registry';

const VIEW_KEY = 'checkit:view';

export default function App() {
  const [view, setView] = useState<ViewState>({ id: 'dashboard' });
  const [hydrated, setHydrated] = useState(false);

  // Restore last view on mount
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

  // Persist
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch {}
  }, [view, hydrated]);

  // Don't render until we've tried to restore — avoids a flash of dashboard
  // when the user was last on chat. The flash is brief but visible.
  if (!hydrated) {
    return <main style={{ visibility: 'hidden' }} />;
  }

  return <>{renderView(view, setView)}</>;
}
