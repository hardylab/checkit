// tests/e2e/rules-market.spec.ts — /rules VSCode-style 3-pane marketplace.
//
// Layout mirrors the prototype:
//   activity-bar | side-rail (scope tabs + cat nav) | market-main (set list | rule list)
//
// Drill-down: scope → category → set → rules.

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Start each test with a clean slate — no installed sets, no rule configs.
  await page.goto('/rules');
  await page.evaluate(() => {
    localStorage.removeItem('checkit:installed-sets');
    localStorage.removeItem('checkit:installed-rules');
    localStorage.removeItem('checkit:rule-config');
  });
});

test.describe('Side rail — VSCode layout', () => {
  test('renders scope tabs (我的规则 / 所有规则) at the top of side rail', async ({ page }) => {
    await page.reload();
    await expect(page.getByRole('tab', { name: '我的规则' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '所有规则' })).toBeVisible();
  });

  test('renders category nav below tabs', async ({ page }) => {
    await page.reload();
    for (const cat of ['安全合规', '代码质量', '架构 / 规范', '文件 / Git', '测试覆盖', '依赖卫生', '文档质量']) {
      await expect(page.getByRole('button', { name: new RegExp(`^${cat}\\s+\\d+$`) })).toBeVisible();
    }
  });

  test('shows empty state until a category is selected', async ({ page }) => {
    await page.reload();
    await expect(page.getByRole('heading', { name: '从左侧选一个分类' })).toBeVisible();
    await expect(page.getByText(/共 \d+ 个 set 可选/)).toBeVisible();
  });
});

test.describe('Drill-down: scope → category → set → rules', () => {
  test('clicking a category populates set list', async ({ page }) => {
    await page.reload();
    await page.getByTestId('cat-security').click();
    // The set pane header should appear
    await expect(page.getByRole('heading', { name: '安全合规', level: 2 })).toBeVisible();
    await expect(page.getByText(/1 个规则集/)).toBeVisible();
    // Security-baseline set should be visible in the list
    await expect(page.getByTestId('set-security-baseline')).toBeVisible();
  });

  test('clicking a set populates the rule pane on the right', async ({ page }) => {
    await page.reload();
    await page.getByTestId('cat-security').click();
    await page.getByTestId('set-security-baseline').click();
    // Rule pane header
    await expect(page.locator('[data-testid="rule-pane"]').getByRole('heading', { name: '安全基线' })).toBeVisible();
    // 4 rule rows for this set
    await expect(page.locator('[data-testid="rule-pane"] [data-rule-row]')).toHaveCount(4);
    await expect(page.locator('[data-testid="rule-pane"] [data-rule-id="plaintext-credentials"]')).toBeVisible();
  });

  test('rule toggle flips on/off and persists', async ({ page }) => {
    await page.reload();
    // Wait for the side rail to render — first load triggers API fetch + render
    await expect(page.getByTestId('cat-security')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('cat-security').click();
    await expect(page.getByTestId('set-security-baseline')).toBeVisible();
    await page.getByTestId('set-security-baseline').click();
    await expect(page.locator('[data-testid="rule-pane"]')).toBeVisible();

    const securityToggle = page.getByTestId('rule-toggle-plaintext-credentials');
    await expect(securityToggle).toBeVisible();
    await expect(securityToggle).toHaveClass(/on/);
    await securityToggle.click();
    await expect(securityToggle).not.toHaveClass(/on/);

    await page.reload();
    await expect(page.getByTestId('cat-security')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('cat-security').click();
    await expect(page.getByTestId('set-security-baseline')).toBeVisible();
    await page.getByTestId('set-security-baseline').click();
    await expect(page.getByTestId('rule-toggle-plaintext-credentials')).not.toHaveClass(/on/);
  });

  test('clicking set a second time deselects and hides rule pane', async ({ page }) => {
    await page.reload();
    await page.getByTestId('cat-security').click();
    await page.getByTestId('set-security-baseline').click();
    await expect(page.locator('[data-testid="rule-pane"]')).toBeVisible();
    await page.getByTestId('set-security-baseline').click();
    await expect(page.locator('[data-testid="rule-pane"]')).toBeHidden();
  });

  test('clicking same category twice deselects it', async ({ page }) => {
    await page.reload();
    await page.getByTestId('cat-quality').click();
    await expect(page.getByRole('heading', { name: '代码质量', level: 2 })).toBeVisible();
    await page.getByTestId('cat-quality').click();
    await expect(page.getByRole('heading', { name: '从左侧选一个分类' })).toBeVisible();
  });
});

test.describe('Scope tabs filter the catalog', () => {
  test('我的规则 shows only installed sets', async ({ page }) => {
    await page.reload();
    // Pre-install one set AFTER initial load (so the next reload picks it up).
    await page.evaluate(() => {
      localStorage.setItem('checkit:installed-sets', JSON.stringify(['security-baseline']));
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('tab', { name: '我的规则' }).click();
    // Category list should only contain categories that have installed sets
    await expect(page.getByTestId('cat-security')).toBeVisible();
    // Quality category has ts-strict + code-cleanup + freshness — none installed → no nav item
    await expect(page.getByTestId('cat-quality')).toHaveCount(0);
  });

  test('scope switch resets selection', async ({ page }) => {
    await page.reload();
    await page.getByTestId('cat-quality').click();
    await page.getByTestId('set-ts-strict').click();
    await expect(page.locator('[data-testid="rule-pane"]')).toBeVisible();
    // Switch to mine — selection should reset
    await page.getByRole('tab', { name: '我的规则' }).click();
    await expect(page.getByRole('heading', { name: '从左侧选一个分类' })).toBeVisible();
  });
});

test.describe('Rule drill-down via drawer', () => {
  test('clicking a rule row opens the configuration drawer', async ({ page }) => {
    await page.reload();
    await page.getByTestId('cat-security').click();
    await page.getByTestId('set-security-baseline').click();
    await page.locator('[data-testid="rule-pane"] [data-rule-row]').first().click();
    await expect(page.locator('.drawer.open')).toBeVisible();
    await expect(page.locator('.drawer.open h3')).toContainText('安全基线 /');
  });

  test('drawer save persists toggle', async ({ page }) => {
    await page.reload();
    await page.getByTestId('cat-quality').click();
    await page.getByTestId('set-ts-strict').click();
    await page.locator('[data-testid="rule-pane"] [data-rule-row]').first().click();
    await page.locator('[data-testid="drawer-enabled"]').uncheck();
    await page.locator('[data-testid="drawer-save"]').click();
    await expect(page.locator('.drawer.open')).toBeHidden();
    await expect.poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('checkit:rule-config'));
      if (!raw) return false;
      try { return Object.keys(JSON.parse(raw)).length >= 1; } catch { return false; }
    }, { timeout: 5_000 }).toBe(true);
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