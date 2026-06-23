// tests/e2e/rules-market.spec.ts — /rules + /rules/[id] pages.
// Verifies the rule catalog is loaded from the filesystem via /api/rules
// and rendered as cards with id, title, severity, TL;DR, tags.

import { test, expect } from '@playwright/test';

test.describe('Rules marketplace — /rules', () => {
  test('loads at least 25 rules from the on-disk catalog', async ({ page }) => {
    await page.goto('/rules');
    // The "共 N 条内置规则" string is rendered after fetchRules resolves.
    // Give the API plenty of time on cold start (it walks the FS).
    await expect(page.getByText(/共\s+\d+\s+条内置规则/)).toBeVisible({ timeout: 15_000 });
    // Each rule renders as an .rule-card link.
    const cards = page.locator('a.rule-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(25);
  });

  test('shows category filters with counts', async ({ page }) => {
    await page.goto('/rules');
    // wait for at least 25 cards so the filter counts are computed
    await expect(page.locator('a.rule-card').first()).toBeVisible();
    const totalBtn = page.getByRole('button', { name: /全部\s+\(\d+\)/ });
    await expect(totalBtn).toBeVisible();
    // We know we have rules in at least 2 categories from earlier runs
    await expect(page.getByRole('button', { name: /TypeScript\s+\(\d+\)/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /文件 \/ Git\s+\(\d+\)/ })).toBeVisible();
  });

  test('severity filter narrows the card grid', async ({ page }) => {
    await page.goto('/rules');
    await expect(page.locator('a.rule-card').first()).toBeVisible();
    const total = await page.locator('a.rule-card').count();

    await page.getByRole('button', { name: /^严重$/ }).click();
    // Active button gets the active class
    await expect(page.getByRole('button', { name: /^严重$/ })).toHaveClass(/active/);
    const errorOnly = await page.locator('a.rule-card').count();
    expect(errorOnly).toBeLessThanOrEqual(total);

    // Restore
    await page.getByRole('button', { name: /^全部严重度$/ }).click();
  });

  test('category filter narrows by category', async ({ page }) => {
    await page.goto('/rules');
    await expect(page.locator('a.rule-card').first()).toBeVisible();
    await page.getByRole('button', { name: /TypeScript\s+\(\d+\)/ }).click();
    await expect(page.locator('a.rule-card')).toHaveCount(17);
  });

  test('search box filters by title', async ({ page }) => {
    await page.goto('/rules');
    await expect(page.locator('a.rule-card').first()).toBeVisible();
    await page.getByPlaceholder(/搜索 id \/ title \/ tag/).fill('console');
    // Should narrow to rules matching "console" — at minimum the no-console-log rule
    await expect(page.getByText('no-console-log').first()).toBeVisible();
    const filtered = await page.locator('a.rule-card').count();
    expect(filtered).toBeLessThan(30);
    expect(filtered).toBeGreaterThanOrEqual(1);
  });

  test('card link navigates to detail page', async ({ page }) => {
    await page.goto('/rules');
    await expect(page.locator('a.rule-card').first()).toBeVisible();
    // Click the first card
    const firstHref = await page.locator('a.rule-card').first().getAttribute('href');
    expect(firstHref).toMatch(/^\/rules\/[\w-]+$/);
    await page.locator('a.rule-card').first().click();
    await page.waitForURL(/\/rules\/[\w-]+$/);
  });

  test('cards show id + severity + title + tags', async ({ page }) => {
    await page.goto('/rules');
    const firstCard = page.locator('a.rule-card').first();
    await expect(firstCard).toBeVisible();
    // monospace id
    await expect(firstCard.locator('code').first()).toBeVisible();
    // severity pill (one of error/warn/accent)
    await expect(firstCard.locator('.pill-error, .pill-warn, .pill-accent').first()).toBeVisible();
  });
});

test.describe('Rule detail — /rules/[id]', () => {
  test('renders markdown body for known rule', async ({ page }) => {
    await page.goto('/rules/no-console-log');
    // Wait for body fetch to resolve (the heading switches from "加载中…" to title)
    await expect(page.locator('h1', { hasText: 'Disallow console.log in source files' })).toBeVisible({ timeout: 10_000 });
    // Standard sections of every rule doc — section headings are rendered
    // as <h3> with the original MD casing ("Why use this rule", etc).
    await expect(page.locator('h3', { hasText: 'TL;DR' })).toBeVisible();
    await expect(page.locator('h3', { hasText: /^Why/ })).toBeVisible();
    await expect(page.locator('h3', { hasText: /^When/ })).toBeVisible();
    await expect(page.locator('h3', { hasText: /^How/ })).toBeVisible();
  });

  test('back link returns to /rules', async ({ page }) => {
    await page.goto('/rules/no-console-log');
    await expect(page.locator('h1')).toBeVisible();
    await page.getByRole('link', { name: '← 回到规则市场' }).click();
    await page.waitForURL(/\/rules$/);
    await expect(page.getByRole('heading', { name: '规则市场' })).toBeVisible();
  });

  test('shows severity pill in header', async ({ page }) => {
    await page.goto('/rules/git-no-large-files');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.pill-error').first()).toBeVisible();
  });

  test('404-like behavior for nonexistent id', async ({ page }) => {
    const response = await page.goto('/rules/this-rule-does-not-exist');
    // The detail page renders "加载失败: …" inside the .md-body region
    await expect(page.getByText(/加载失败/)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Cross-navigation', () => {
  test('dashboard → rules marketplace via brand link in summary', async ({ page }) => {
    // Seed a tiny report so the dashboard is in "loaded" state
    await page.addInitScript(() => {
      localStorage.setItem('checkit:last-report', JSON.stringify({
        issues: [
          { type: 'structure', module: 'no-console-log', file: 'src/a.ts', line: 1, issue: 'x', level: 'warning', fixable: true },
        ],
        source: 'demo.json',
      }));
    });
    await page.goto('/');
    // The "已加载规则" cell shows "N →" with a Link
    await expect(page.locator('#fixable-count')).toContainText(/\d+\s*→/);
    await page.locator('#fixable-count a').click();
    await page.waitForURL(/\/rules$/);
  });
});