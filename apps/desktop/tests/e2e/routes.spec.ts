// tests/e2e/routes.spec.ts — verify all views render and the rail works.

import { test, expect, type Page } from '@playwright/test';
import { gotoView, gotoDirectView } from './helpers';

const SAMPLE = {
  issues: [
    { type: 'structure', module: 'no-console-log', file: 'a.ts', line: 1, issue: 'x', level: 'warning', fixable: true },
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

test.describe('Navigation', () => {
  test('brand button returns to dashboard', async ({ page }) => {
    await gotoView(page, 'rules');
    await page.locator('.rail-brand').click();
    await page.waitForSelector('[data-view="dashboard"]', { timeout: 5_000 });
  });

  test('rules rail tab opens rules view', async ({ page }) => {
    await gotoView(page, 'dashboard');
    await page.getByTestId('rail-tab-rules').click();
    await page.waitForSelector('[data-view="rules"]', { timeout: 5_000 });
    // /rules uses a VSCode-style side rail; the visible "规则市场" label
    // lives in the side rail eyebrow, not a heading.
    await expect(page.locator('.rules-side-eyebrow')).toContainText('规则市场');
  });

  test('chat rail tab opens chat view', async ({ page }) => {
    await gotoView(page, 'dashboard');
    await page.getByTestId('rail-tab-chat').click();
    await page.waitForSelector('[data-view="chat"]', { timeout: 5_000 });
    await expect(page.getByRole('heading', { name: 'AI 规则助手' })).toBeVisible();
  });

  test('active rail tab is highlighted correctly', async ({ page }) => {
    await gotoView(page, 'rules');
    await expect(page.getByTestId('rail-tab-rules')).toHaveClass(/active/);

    await page.getByTestId('rail-tab-chat').click();
    await page.waitForSelector('[data-view="chat"]');
    await expect(page.getByTestId('rail-tab-chat')).toHaveClass(/active/);

    await page.locator('.rail-brand').click();
    await page.waitForSelector('[data-view="dashboard"]');
    await expect(page.getByTestId('rail-tab-dashboard')).toHaveClass(/active/);
  });
});

test.describe('Rules marketplace', () => {
  test('renders VSCode-style marketplace with side rail + set pane', async ({ page }) => {
    await gotoView(page, 'rules');
    await expect(page.locator('.rules-side-eyebrow')).toContainText('规则市场', { timeout: 10_000 });
    await expect(page.getByRole('tab', { name: '我的规则' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '所有规则' })).toBeVisible();
    await expect(page.getByTestId('cat-security')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Chat view', () => {
  test('shows real chat UI with suggestions and quick keywords', async ({ page }) => {
    await gotoView(page, 'chat');
    await expect(page.getByRole('heading', { name: 'AI 规则助手' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder('输入消息')).toBeVisible();
    await expect(page.getByRole('button', { name: /我想加强 SQL 注入检查/ })).toBeVisible();
  });
});

test.describe('AI-fix navigation', () => {
  test('clicking AI fix CTA from dashboard opens ai-fix view with right state', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await page.waitForSelector('.issue-row', { timeout: 10_000 });
    await page.locator('.issue-row').first().click();
    // Right pane CTA (after an issue is selected). The dash-main also renders
    // a "一键 AI 修复 (N)" summary button — use the →-suffixed action button.
    await page.getByRole('button', { name: /一键 AI 修复 →/ }).click();
    await page.waitForSelector('[data-view="ai-fix"]', { timeout: 5_000 });
    // URL is the source of truth for routing state.
    const path = new URL(page.url()).pathname;
    expect(path).toBe('/ai-fix/demo.json/0');
  });

  test('AI fix view is reachable directly via URL', async ({ page }) => {
    await gotoDirectView(page, 'ai-fix', {
      'checkit:last-report': SAMPLE,
    });
    await expect(page.locator('.ai-fix-page')).toBeVisible();
  });
});

test.describe('Responsive', () => {
  test('mobile viewport collapses 3-pane to single column', async ({ page }) => {
    await seed(page);
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/');
    await page.waitForSelector('.dash', { timeout: 10_000 });
    const gridColumns = await page.locator('.dash').evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    expect(gridColumns.split(' ').length).toBeLessThanOrEqual(1);
    await expect(page.locator('.side-rail')).toBeHidden();
  });

  test('mobile viewport collapses ai-fix to single column', async ({ page }) => {
    await seed(page);
    await page.setViewportSize({ width: 800, height: 600 });
    await gotoDirectView(page, 'ai-fix', {
      'checkit:last-report': SAMPLE,
    });
    const gridColumns = await page.locator('.ai-fix-page').evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    expect(gridColumns.split(' ').length).toBeLessThanOrEqual(1);
  });

  test('desktop viewport keeps 3-pane', async ({ page }) => {
    await seed(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForSelector('.dash', { timeout: 10_000 });
    await expect(page.locator('.side-rail')).toBeVisible();
    await expect(page.locator('.dash-main')).toBeVisible();
    await expect(page.locator('.dash-right')).toBeVisible();
  });
});

test.describe('Theme', () => {
  test('default theme is light', async ({ page }) => {
    await page.goto('/');
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(theme === null || theme === 'light').toBe(true);
  });

  test('theme toggle button is present in topbar', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: '切换主题' })).toBeVisible();
  });
});
