// tests/e2e/helpers.ts — shared helpers for the SPA app.
//
// Post-refactor: the app is a strict react-router SPA using BrowserRouter.
// URL semantics live in `window.location.pathname` (clean `/path` URLs).
//
//   - `gotoView(view)`   → goto `/<view-path>`, wait for the active view.
//   - `gotoDirectView`   → goto `/<sub-view-path>` with URL params derived
//                          from the seed bag (e.g. /ai-fix/foo.json/0).
//   - `clickTab(view)`   → click a top-level rail tab.
//
// `checkit:last-report` is still seeded via localStorage (it's data, not
// routing state). The old `checkit:view` key is gone — no longer needed.

import type { Page, BrowserContext } from '@playwright/test';

export type ViewId =
  | 'dashboard'
  | 'rules'
  | 'rule-detail'
  | 'chat'
  | 'ai-fix'
  | 'presets'
  | 'workspaces';

/**
 * Map a view id to its canonical URL path. For sub-views that need params
 * (rule-detail, ai-fix) we pull them from the seed bag if present.
 *
 * Returns a path like `/chat` or `/ai-fix/demo.json/0`.
 */
function pathFor(view: ViewId, seed: Record<string, unknown> = {}): string {
  switch (view) {
    case 'dashboard':
      return '/';
    case 'rules':
      return '/rules';
    case 'rule-detail': {
      const ruleId =
        typeof seed['checkit:rule-id'] === 'string'
          ? (seed['checkit:rule-id'] as string)
          : 'no-console-log';
      return `/rules/${encodeURIComponent(ruleId)}`;
    }
    case 'chat':
      return '/chat';
    case 'ai-fix': {
      let file = 'demo.json';
      let idx = 0;
      if (typeof seed['checkit:ai-file'] === 'string') {
        file = seed['checkit:ai-file'] as string;
      } else {
        const report = seed['checkit:last-report'] as { source?: string } | undefined;
        if (report && typeof report.source === 'string') file = report.source;
      }
      if (typeof seed['checkit:ai-idx'] === 'number') {
        idx = seed['checkit:ai-idx'] as number;
      }
      return `/ai-fix/${encodeURIComponent(file)}/${idx}`;
    }
    case 'presets':
      return '/presets';
    case 'workspaces':
      return '/workspaces';
  }
}

/**
 * Navigate directly to a top-level view.
 */
export async function gotoView(
  page: Page,
  view: ViewId,
  opts: { seed?: Record<string, unknown> } = {}
) {
  const seed = opts.seed ?? {};
  await page.addInitScript(({ seed }) => {
    for (const [k, v] of Object.entries(seed)) {
      localStorage.setItem(k, JSON.stringify(v));
    }
  }, { seed });

  await page.goto(pathFor(view, seed));
  await page.waitForSelector(`[data-view="${view}"]`, { timeout: 10_000 });
}

/**
 * Navigate directly to a sub-view (rule-detail, ai-fix) using parameters
 * extracted from the seed bag.
 */
export async function gotoDirectView(
  page: Page,
  viewId: string,
  seed: Record<string, unknown> = {}
) {
  await page.addInitScript(({ seed }) => {
    for (const [k, v] of Object.entries(seed)) {
      localStorage.setItem(k, JSON.stringify(v));
    }
  }, { seed });
  await page.goto(pathFor(viewId as ViewId, seed));
  await page.waitForSelector(`[data-view="${viewId}"]`, { timeout: 10_000 });
}

/**
 * Click a top-level rail tab. Used in tests that already have the app mounted.
 */
export async function clickTab(page: Page, view: ViewId) {
  await page.getByTestId(`rail-tab-${view}`).click();
  await page.waitForSelector(`[data-view="${view}"]`, { timeout: 5_000 });
}
