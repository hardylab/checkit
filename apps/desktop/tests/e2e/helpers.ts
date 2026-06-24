// tests/e2e/helpers.ts — shared helpers for the SPA app.
//
// The app is a single-page React SPA. "Navigation" between views is an
// in-memory state change, not a URL change. The URL stays at "/" forever.
// So instead of `page.goto('/chat')` we use `gotoView('chat')` which:
//   1. Seeds any localStorage the view needs
//   2. Goes to "/"
//   3. Waits for the target view to be the active one
//
// `waitForURL` is gone — there's no URL change to wait for. Use waitForView
// for the equivalent assertion.

import type { Page, BrowserContext } from '@playwright/test';

export type ViewId = 'dashboard' | 'rules' | 'chat' | 'ai-fix';

export async function gotoView(
  page: Page,
  view: ViewId,
  opts: { seed?: Record<string, unknown>; viaTab?: boolean } = {}
) {
  // Seed the target view directly into localStorage (so it survives reloads).
  // NOTE: addInitScript re-runs on EVERY navigation including `page.reload()`,
  // so we must NOT clear keys here — that would wipe the view state the app
  // just persisted. Just overwrite with what we want.
  await page.addInitScript(({ view, seed }) => {
    localStorage.setItem('checkit:view', JSON.stringify({ id: view }));
    if (seed) {
      for (const [k, v] of Object.entries(seed)) {
        localStorage.setItem(k, JSON.stringify(v));
      }
    }
  }, { view, seed: opts.seed });

  // First load — SpApp hydrates from localStorage and renders the target view
  await page.goto('/');

  // Wait for the view container to render (hydrated)
  await page.waitForSelector(`[data-view="${view}"]`, { timeout: 10_000 });
}

// For tests that need a specific sub-view (rule-detail, ai-fix) seeded via
// localStorage, we don't go through the rail tab — we set the view state
// directly and goto /. Used by ai-fix and rule-detail tests.
export async function gotoDirectView(
  page: Page,
  viewId: string,
  seed: Record<string, unknown> = {}
) {
  await page.addInitScript(({ viewId, seed }) => {
    localStorage.setItem('checkit:view', JSON.stringify({ id: viewId }));
    for (const [k, v] of Object.entries(seed)) {
      localStorage.setItem(k, JSON.stringify(v));
    }
  }, { viewId, seed });
  await page.goto('/');
  await page.waitForSelector(`[data-view="${viewId}"]`, { timeout: 10_000 });
}

// Convenience for navigating by clicking a tab from a test that already has
// the app mounted.
export async function clickTab(page: Page, view: ViewId) {
  await page.getByTestId(`rail-tab-${view}`).click();
  await page.waitForSelector(`[data-view="${view}"]`, { timeout: 5_000 });
}
