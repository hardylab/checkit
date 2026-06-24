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
  // 1. Reset view state + any seed data
  await page.addInitScript(({ seed }) => {
    localStorage.removeItem('checkit:view');
    if (seed) {
      for (const [k, v] of Object.entries(seed)) {
        localStorage.setItem(k, JSON.stringify(v));
      }
    }
  }, { seed: opts.seed });

  // 2. First load — let the app hydrate with our seed
  await page.goto('/');

  // 3. Wait for the shell to mount
  await page.waitForSelector('[data-testid="rail-tab-dashboard"]', { timeout: 10_000 });

  // 4. Click the right rail tab (or trust localStorage seed for default dashboard)
  if (view !== 'dashboard' || opts.viaTab) {
    await page.getByTestId(`rail-tab-${view}`).click();
  }

  // 5. Wait for the view container to render
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
