// tests/e2e/rules-market.spec.ts — /rules page (set-based catalog).
// After the prototype-based rework, /rules shows 10 rule SETS instead
// of 28 individual rules. Individual rules are accessible via the
// drawer (clicking a rule pill inside a set card).
// This file focuses on the marketplace structure: tabs, filters,
// search, set card layout. Drawer interactions are in rule-sets.spec.ts.

import { test, expect } from '@playwright/test';

test.describe('Rules marketplace — set-based catalog', () => {
  test('renders at least 10 rule sets', async ({ page }) => {
    await page.goto('/rules');
    await expect(page.getByText(/共\s+\d+\s+个 set/)).toBeVisible({ timeout: 15_000 });
    const cards = page.locator('[data-set-card]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('shows tabs: 我的规则 / 所有规则', async ({ page }) => {
    await page.goto('/rules');
    await expect(page.getByRole('button', { name: /我的规则/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /所有规则/ })).toBeVisible();
  });

  test('category filters visible with counts', async ({ page }) => {
    await page.goto('/rules');
    await expect(page.locator('[data-set-card]').first()).toBeVisible();
    for (const cat of ['安全合规', '代码质量', '架构 / 规范', '文件 / Git', '测试覆盖']) {
      await expect(page.getByRole('button', { name: new RegExp(`${cat}\\s+\\(\\d+\\)`) })).toBeVisible();
    }
  });

  test('search box filters sets by name', async ({ page }) => {
    await page.goto('/rules');
    await expect(page.locator('[data-set-card]').first()).toBeVisible();
    await page.getByPlaceholder(/搜索 set/).fill('流水线');
    // Only flow-naming-rule set matches "流水线"
    await expect(page.locator('[data-set-card]')).toHaveCount(1);
    await expect(page.locator('[data-set-card] h2')).toContainText('流水线命名');
  });

  test('cards show source pill (官方/社区/团队)', async ({ page }) => {
    await page.goto('/rules');
    await expect(page.locator('[data-set-card]').first()).toBeVisible();
    // At least one 官方 and one 社区 pill should be visible across all cards
    const officials = await page.locator('[data-set-card] >> text=官方').count();
    const community = await page.locator('[data-set-card] >> text=社区').count();
    expect(officials).toBeGreaterThan(0);
    expect(community).toBeGreaterThan(0);
  });
});

test.describe('Rule detail — drawer (via set card rule pill)', () => {
  test('clicking a rule pill opens drawer with set context', async ({ page }) => {
    await page.goto('/rules');
    await expect(page.locator('[data-set-card]').first()).toBeVisible();
    await page.locator('[data-rule-id="no-console-log"]').click();
    await expect(page.locator('.drawer.open')).toBeVisible();
    await expect(page.locator('.drawer.open h3')).toContainText('代码整洁 /');
    await expect(page.locator('.drawer.open h3')).toContainText('no-console-log');
  });

  test('drawer "back" is the close button or overlay click', async ({ page }) => {
    await page.goto('/rules');
    await expect(page.locator('[data-set-card]').first()).toBeVisible();
    await page.locator('[data-rule-id="git-no-large-files"]').click();
    await expect(page.locator('.drawer.open')).toBeVisible();
    await page.locator('.drawer-close').click();
    await expect(page.locator('.drawer.open')).toBeHidden();
  });

  test('drawer shows severity pill in header', async ({ page }) => {
    await page.goto('/rules');
    await expect(page.locator('[data-set-card]').first()).toBeVisible();
    await page.locator('[data-rule-id="git-no-large-files"]').click();
    await expect(page.locator('.drawer.open .pill-error')).toBeVisible();
  });
});

test.describe('Cross-navigation', () => {
  test('dashboard → rules marketplace via "已加载规则" link', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('checkit:last-report', JSON.stringify({
        issues: [{ type: 'structure', module: 'no-console-log', file: 'src/a.ts', line: 1, issue: 'x', level: 'warning', fixable: true }],
        source: 'demo.json',
      }));
    });
    await page.goto('/');
    await expect(page.locator('#fixable-count')).toContainText(/\d+\s*→/);
    await page.locator('#fixable-count a').click();
    await page.waitForURL(/\/rules$/);
  });
});