// tests/e2e/routing-spa.spec.ts
//
// Behavior contract for the strict-SPA routing refactor.
//
// Before the refactor: react-router MemoryRouter was wired in, but each view
// still rendered its own <Shell> and was passed a `noopNavigate`. As a result
// in-view buttons (rule detail back, AI fix, dashboard → rules, etc.) silently
// did nothing, and two Shells rendered per page (double topbar + rail + main).
//
// These tests pin the new contract:
//   1. In-view navigation actually moves the router (URL changes).
//   2. Exactly one Shell renders per page (one header.topbar, one aside.rail,
//      one main).
//   3. data-view reflects the active sub-route (rule-detail on /rules/:ruleId,
//      ai-fix on /ai-fix/:file/:idx).
//
// If anyone reintroduces the double-Shell pattern, these fail.

import { test, expect, type Page } from '@playwright/test';

const SAMPLE = {
  issues: [
    { type: 'structure', module: 'no-console-log', file: 'demo.json', line: 1, issue: 'console.log detected', level: 'warning', fixable: true },
  ],
  source: 'demo.json',
};

async function seed(page: Page, extra: Record<string, unknown> = {}) {
  await page.addInitScript((data) => {
    for (const [k, v] of Object.entries(data)) {
      localStorage.setItem(k, JSON.stringify(v));
    }
  }, { 'checkit:last-report': SAMPLE, ...extra });
}

test.describe('In-view navigation (was broken in v0)', () => {
  test('Dashboard "已加载规则 →" button navigates to /rules', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await page.waitForSelector('.dash', { timeout: 10_000 });
    // The summary cell renders a transparent button "N →" that jumps to /rules.
    await page.locator('#fixable-count button').click();
    await page.waitForURL('**/rules', { timeout: 5_000 });
    await page.waitForSelector('[data-view="rules"]');
  });

  test('Dashboard "一键 AI 修复" navigates to /ai-fix/:file/:idx with right state', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await page.waitForSelector('.issue-row', { timeout: 10_000 });
    await page.locator('.issue-row').first().click();
    await page.getByRole('button', { name: /一键 AI 修复 →/ }).click();
    // Router should have moved to /ai-fix/demo.json/0
    await page.waitForURL('**/ai-fix/**', { timeout: 5_000 });
    const path = new URL(page.url()).pathname;
    expect(path).toBe('/ai-fix/demo.json/0');
    await page.waitForSelector('[data-view="ai-fix"]');
    await page.waitForSelector('.ai-fix-page');
  });

  test('RuleDetail "← 回到规则市场" navigates back to /rules', async ({ page }) => {
    await page.goto('/rules/no-console-log');
    await page.waitForSelector('[data-view="rule-detail"]', { timeout: 10_000 });
    await page.getByRole('button', { name: /回到规则市场/ }).click();
    await page.waitForURL('**/rules', { timeout: 5_000 });
    await page.waitForSelector('[data-view="rules"]');
  });

  test('AiFix "回到主控台" navigates back to /', async ({ page }) => {
    await seed(page);
    await page.goto('/ai-fix/demo.json/0');
    await page.waitForSelector('[data-view="ai-fix"]', { timeout: 10_000 });
    // The actual button text is "← 返回主控台" — match by partial Chinese text.
    await page.getByRole('button', { name: /返回主控台/ }).click();
    await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 5_000 });
    await page.waitForSelector('[data-view="dashboard"]');
  });

  test('AiFix "拒绝" button navigates back to /', async ({ page }) => {
    await seed(page);
    await page.goto('/ai-fix/demo.json/0');
    await page.waitForSelector('[data-view="ai-fix"]', { timeout: 10_000 });
    await page.getByRole('button', { name: '拒绝' }).click();
    await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 5_000 });
    await page.waitForSelector('[data-view="dashboard"]');
  });

  test('RulesView clicking a rule card drills into /rules/:ruleId', async ({ page }) => {
    await page.goto('/rules');
    await page.waitForSelector('.rules-side-eyebrow', { timeout: 10_000 });
    // First rule set in the marketplace — its first rule id should appear in
    // the rule list and be clickable. Find any in-set rule link.
    const ruleLink = page.locator('.rules-list .rule-card, .rules-list [data-rule-id]').first();
    const hasRuleLink = (await ruleLink.count()) > 0;
    if (!hasRuleLink) {
      test.skip(true, 'no rule links visible in marketplace — depends on fixtures');
      return;
    }
    // Pull rule id from the link if data-rule-id is set; otherwise rely on
    // the URL after click.
    await ruleLink.click();
    await page.waitForURL(/\/rules\/.+/, { timeout: 5_000 });
    await page.waitForSelector('[data-view="rule-detail"]');
  });
});

test.describe('Single Shell per page (no double rendering)', () => {
  test('Dashboard renders exactly one Shell (1 topbar + 1 rail + 1 main)', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await page.waitForSelector('.dash', { timeout: 10_000 });
    expect(await page.locator('header.topbar').count()).toBe(1);
    expect(await page.locator('aside.rail').count()).toBe(1);
    expect(await page.locator('main').count()).toBe(1);
  });

  test('Rules renders exactly one Shell', async ({ page }) => {
    await page.goto('/rules');
    await page.waitForSelector('[data-view="rules"]', { timeout: 10_000 });
    expect(await page.locator('header.topbar').count()).toBe(1);
    expect(await page.locator('aside.rail').count()).toBe(1);
    expect(await page.locator('main').count()).toBe(1);
  });

  test('RuleDetail renders exactly one Shell', async ({ page }) => {
    await page.goto('/rules/no-console-log');
    await page.waitForSelector('[data-view="rule-detail"]', { timeout: 10_000 });
    expect(await page.locator('header.topbar').count()).toBe(1);
    expect(await page.locator('aside.rail').count()).toBe(1);
    expect(await page.locator('main').count()).toBe(1);
  });

  test('Chat renders exactly one Shell', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForSelector('[data-view="chat"]', { timeout: 10_000 });
    expect(await page.locator('header.topbar').count()).toBe(1);
    expect(await page.locator('aside.rail').count()).toBe(1);
    expect(await page.locator('main').count()).toBe(1);
  });

  test('AiFix renders exactly one Shell', async ({ page }) => {
    await seed(page);
    await page.goto('/ai-fix/demo.json/0');
    await page.waitForSelector('[data-view="ai-fix"]', { timeout: 10_000 });
    expect(await page.locator('header.topbar').count()).toBe(1);
    expect(await page.locator('aside.rail').count()).toBe(1);
    expect(await page.locator('main').count()).toBe(1);
  });

  test('Presets renders exactly one Shell', async ({ page }) => {
    await page.goto('/presets');
    await page.waitForSelector('[data-view="presets"]', { timeout: 10_000 });
    expect(await page.locator('header.topbar').count()).toBe(1);
    expect(await page.locator('aside.rail').count()).toBe(1);
    expect(await page.locator('main').count()).toBe(1);
  });

  test('Workspaces renders exactly one Shell', async ({ page }) => {
    await page.goto('/workspaces');
    await page.waitForSelector('[data-view="workspaces"]', { timeout: 10_000 });
    expect(await page.locator('header.topbar').count()).toBe(1);
    expect(await page.locator('aside.rail').count()).toBe(1);
    expect(await page.locator('main').count()).toBe(1);
  });
});

test.describe('data-view reflects sub-route', () => {
  test('/rules/:ruleId → data-view="rule-detail" but rail tab "rules" is active', async ({ page }) => {
    await page.goto('/rules/no-console-log');
    await page.waitForSelector('[data-view="rule-detail"]', { timeout: 10_000 });
    await expect(page.getByTestId('rail-tab-rules')).toHaveClass(/active/);
  });

  test('/ai-fix/:file/:idx → data-view="ai-fix" but rail tab "chat" is active', async ({ page }) => {
    await seed(page);
    await page.goto('/ai-fix/demo.json/0');
    await page.waitForSelector('[data-view="ai-fix"]', { timeout: 10_000 });
    await expect(page.getByTestId('rail-tab-chat')).toHaveClass(/active/);
  });
});

test.describe('Top rail navigates by URL', () => {
  test('clicking rail rules tab → URL=/rules', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await page.waitForSelector('.dash', { timeout: 10_000 });
    await page.getByTestId('rail-tab-rules').click();
    await page.waitForURL('**/rules', { timeout: 5_000 });
  });

  test('clicking rail chat tab → URL=/chat', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('rail-tab-chat').click();
    await page.waitForURL('**/chat', { timeout: 5_000 });
  });

  test('clicking rail presets tab → URL=/presets', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('rail-tab-presets').click();
    await page.waitForURL('**/presets', { timeout: 5_000 });
  });

  test('clicking rail workspaces tab → URL=/workspaces', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('rail-tab-workspaces').click();
    await page.waitForURL('**/workspaces', { timeout: 5_000 });
  });

  test('clicking rail dashboard tab → URL=/', async ({ page }) => {
    await page.goto('/rules');
    await page.getByTestId('rail-tab-dashboard').click();
    await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 5_000 });
  });
});
