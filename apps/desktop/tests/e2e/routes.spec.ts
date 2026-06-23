// tests/e2e/routes.spec.ts — verify all 4 routes load and the nav works.

import { test, expect, type Page } from '@playwright/test';

const SAMPLE = {
  issues: [
    { type: 'structure', module: 'no-console-log', file: 'a.ts', line: 1, issue: 'x', level: 'warning', fixable: true },
  ],
  source: 'demo.json',
};

async function seed(page: Page) {
  await page.addInitScript((r) => {
    localStorage.setItem('checkit:last-report', JSON.stringify(r));
  }, SAMPLE);
}

test.describe('Navigation', () => {
  test('topbar brand link returns to /', async ({ page }) => {
    await page.goto('/rules');
    await page.locator('.rail-brand').click();
    await page.waitForURL(/\/$/);
  });

  test('rules tab navigates to /rules', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: '规则市场' }).first().click();
    await page.waitForURL(/\/rules/);
    // /rules now uses a VSCode-style side rail; the visible "规则市场"
    // label lives in the side rail eyebrow (.rules-side-eyebrow), not a heading.
    await expect(page.locator('.rules-side-eyebrow')).toContainText('规则市场');
  });

  test('chat tab navigates to /chat', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Chat' }).first().click();
    await page.waitForURL(/\/chat/);
    await expect(page.getByRole('heading', { name: 'AI 规则助手' })).toBeVisible();
  });

  test('active tab is highlighted correctly', async ({ page }) => {
    await page.goto('/rules');
    await expect(page.locator('.rail-tab.active')).toHaveAttribute('aria-label', '规则市场');

    await page.goto('/chat');
    await expect(page.locator('.rail-tab.active')).toHaveAttribute('aria-label', 'Chat');

    await page.goto('/');
    await expect(page.locator('.rail-tab.active')).toHaveAttribute('aria-label', '主控台');
  });
});

test.describe('Rules marketplace — placeholder', () => {
  test('rules marketplace renders VSCode-style marketplace with side rail + set pane', async ({ page }) => {
    await page.goto('/rules');
    // "规则市场" lives in the side rail eyebrow, not a heading.
    await expect(page.locator('.rules-side-eyebrow')).toContainText('规则市场', { timeout: 10_000 });
    // Side rail should show scope tabs + category nav
    await expect(page.getByRole('tab', { name: '我的规则' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '所有规则' })).toBeVisible();
    // Wait for the side rail to finish populating categories after the initial render
    await expect(page.getByTestId('cat-security')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Chat page (replaces placeholder)', () => {
  test('shows real chat UI with suggestions and quick keywords', async ({ page }) => {
    await page.goto('/chat');
    await expect(page.getByRole('heading', { name: 'AI 规则助手' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder('输入消息')).toBeVisible();
    await expect(page.getByRole('button', { name: /我想加强 SQL 注入检查/ })).toBeVisible();
  });
});

test.describe('AI-fix navigation', () => {
  test('clicking AI fix CTA from dashboard opens /ai-fix with right query', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await page.locator('.issue-row').first().click();
    const link = page.getByRole('link', { name: /一键 AI 修复/ });
    await link.click();
    await page.waitForURL(/\/ai-fix/);
    const url = new URL(page.url());
    expect(url.searchParams.get('idx')).toBe('0');
    expect(url.searchParams.get('file')).toBe('demo.json');
  });

  test('AI fix page is reachable directly via URL', async ({ page }) => {
    await seed(page);
    await page.goto('/ai-fix?idx=0&file=demo.json');
    await expect(page.locator('.ai-fix-page')).toBeVisible();
  });
});

test.describe('Responsive', () => {
  test('mobile viewport collapses 3-pane to single column', async ({ page }) => {
    await seed(page);
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/');
    // At <1024px, .dash is single column
    const gridColumns = await page.locator('.dash').evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    // Single column = only one width value, not three
    expect(gridColumns.split(' ').length).toBeLessThanOrEqual(1);
    // Side rail hidden
    await expect(page.locator('.side-rail')).toBeHidden();
  });

  test('mobile viewport collapses ai-fix to single column', async ({ page }) => {
    await seed(page);
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/ai-fix?idx=0&file=demo.json');
    const gridColumns = await page.locator('.ai-fix-page').evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    expect(gridColumns.split(' ').length).toBeLessThanOrEqual(1);
  });

  test('desktop viewport keeps 3-pane', async ({ page }) => {
    await seed(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
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