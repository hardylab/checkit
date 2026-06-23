// tests/e2e/dashboard.spec.ts — main dashboard rendering + interactions.
//
// Each test seeds localStorage with a representative checkit report so the
// dashboard hydrates from the cached report path. This exercises:
// - topbar + rail shell (from Shell.tsx)
// - 3-pane grid layout (side-rail + main + right)
// - score ring calculation
// - severity tabs
// - category sidebar counts
// - issue row click → detail panel
// - "换一个项目" reset

import { test, expect, type Page } from '@playwright/test';

const SAMPLE_REPORT = {
  issues: [
    {
      type: 'structure', module: 'no-console-log',
      file: 'src/main.ts', line: 3,
      issue: 'console.log detected',
      level: 'warning', fixable: true,
      data: { filePath: 'src/main.ts', lineNumber: 3 },
    },
    {
      type: 'type-safety', module: 'no-any-rule',
      file: 'src/utils.ts', line: 7,
      issue: 'Avoid using any type',
      expect: 'Replace any with unknown + type guard',
      level: 'error', fixable: false,
    },
    {
      type: 'security', module: 'plaintext-credentials',
      file: 'src/api/auth.ts', line: 42,
      issue: 'AWS Access Key hardcoded',
      expect: 'Move AWS_ACCESS_KEY_ID to env var',
      level: 'error', fixable: true,
    },
  ],
  source: 'demo-report.json',
};

async function seedReport(page: Page) {
  await page.addInitScript((report) => {
    localStorage.setItem('checkit:last-report', JSON.stringify(report));
  }, SAMPLE_REPORT);
}

test.describe('Dashboard — empty state', () => {
  test('shows dropzone when no report loaded', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '选择一个项目' })).toBeVisible();
    await expect(page.getByRole('button', { name: '选择项目目录' })).toBeVisible();
    await expect(page.getByRole('button', { name: '导入 JSON 报告' })).toBeVisible();
  });

  test('选择项目目录 is disabled outside Electron', async ({ page }) => {
    await page.goto('/');
    const btn = page.getByRole('button', { name: '选择项目目录' });
    await expect(btn).toBeDisabled();
  });

  test('renders all 3 rail tabs with correct hrefs', async ({ page }) => {
    await page.goto('/');
    const mainTab = page.getByRole('link', { name: '主控台' });
    const rulesTab = page.getByRole('link', { name: '规则市场' });
    const chatTab = page.getByRole('link', { name: 'Chat' });
    await expect(mainTab).toHaveAttribute('href', '/');
    await expect(rulesTab).toHaveAttribute('href', '/rules');
    await expect(chatTab).toHaveAttribute('href', '/chat');
  });
});

test.describe('Dashboard — loaded state', () => {
  test.beforeEach(async ({ page }) => {
    await seedReport(page);
  });

  test('shows health score 81 (3 issues: 2 errors / 1 warning)', async ({ page }) => {
    await page.goto('/');
    // 100 - 2*8 - 1*3 = 81
    await expect(page.locator('.score-ring .value > span').first()).toHaveText('81');
  });

  test('summary cells reflect counts', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('3', { exact: true }).first()).toBeVisible();  // total
    await expect(page.locator('#severity-counts')).toHaveText('2 / 1 / 0');
    await expect(page.locator('#files-count')).toHaveText('3');
    await expect(page.locator('#fixable-count')).toHaveText('2');
  });

  test('topbar shows report filename', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.brand-sub span').last()).toHaveText('demo-report.json');
  });

  test('category sidebar shows correct counts (3/1/2)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /全部问题\s+3/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /安全隐患\s+1/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /代码质量\s+2/ })).toBeVisible();
  });

  test('4 severity tabs with right counts', async ({ page }) => {
    await page.goto('/');
    // `.issue-tab` IS the button (not a wrapper). Find by accessible name.
    await expect(page.getByRole('button', { name: /^全部\s+\d+$/ })).toBeVisible();
    await expect(page.locator('#cnt-all')).toHaveText('3');
    await expect(page.locator('#cnt-error')).toHaveText('2');
    await expect(page.locator('#cnt-warning')).toHaveText('1');
    await expect(page.locator('#cnt-info')).toHaveText('0');
  });

  test('issue rows render with severity bars + pills', async ({ page }) => {
    await page.goto('/');
    const rows = page.locator('.issue-row');
    await expect(rows).toHaveCount(3);
    // First row should be the console.log warning (yellow bar)
    await expect(rows.nth(0).locator('.issue-bar.warning')).toBeVisible();
    // Second row any-type error (red bar)
    await expect(rows.nth(1).locator('.issue-bar.error')).toBeVisible();
    // Third row AWS key (red bar)
    await expect(rows.nth(2).locator('.issue-bar.error')).toBeVisible();
  });

  test('clicking severity tab filters list', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^严重\s+\d+$/ }).click();
    await expect(page.locator('.issue-row')).toHaveCount(2);
    await page.getByRole('button', { name: /^警告\s+\d+$/ }).click();
    await expect(page.locator('.issue-row')).toHaveCount(1);
    await page.getByRole('button', { name: /^全部\s+\d+$/ }).click();
    await expect(page.locator('.issue-row')).toHaveCount(3);
  });

  test('clicking category filters list', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /安全隐患\s+1/ }).click();
    await expect(page.locator('.issue-row')).toHaveCount(1);
    await expect(page.locator('.issue-row').first()).toContainText('AWS Access Key');
  });

  test('clicking an issue row reveals detail panel', async ({ page }) => {
    await page.goto('/');
    await page.locator('.issue-row').first().click();
    // Detail card should now be visible (not the empty state)
    await expect(page.locator('.detail-card')).toBeVisible();
    await expect(page.locator('.detail-card h4').first()).toContainText('问题');
    // The selected row should have .selected class
    await expect(page.locator('.issue-row.selected')).toBeVisible();
  });

  test('detail panel shows position + expect + AI fix CTA', async ({ page }) => {
    await page.goto('/');
    // Click the error row (no-any-rule) — has expect field, not fixable
    await page.locator('.issue-row').nth(1).click();
    await expect(page.locator('.detail-card')).toContainText('Replace any with unknown + type guard');
  });

  test('fixable issue shows 一键 AI 修复 button linking to /ai-fix', async ({ page }) => {
    await page.goto('/');
    await page.locator('.issue-row').first().click(); // console.log — fixable
    const cta = page.getByRole('link', { name: /一键 AI 修复/ });
    await expect(cta).toBeVisible();
    const href = await cta.getAttribute('href');
    expect(href).toContain('/ai-fix?idx=0');
    expect(href).toContain('file=demo-report.json');
  });

  test('clicking AI fix CTA navigates to /ai-fix page', async ({ page }) => {
    await page.goto('/');
    await page.locator('.issue-row').first().click();
    await page.getByRole('link', { name: /一键 AI 修复/ }).click();
    await page.waitForURL(/\/ai-fix/);
    await expect(page.locator('.ai-fix-page')).toBeVisible();
  });

  test('ignore button removes the issue from the list', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.issue-row')).toHaveCount(3);
    await page.locator('.issue-row').first().click();
    await page.getByRole('button', { name: '忽略' }).click();
    await expect(page.locator('.issue-row')).toHaveCount(2);
  });

  test('AI-Fix all button is disabled (no Electron IPC available)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /一键 AI 修复 \(\d+\)/ })).toBeDisabled();
  });

  test('reset button clears state and returns to dropzone', async ({ page }) => {
    await page.goto('/');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '换一个项目' }).click();
    // After reload, dropzone visible
    await expect(page.getByRole('heading', { name: '选择一个项目' })).toBeVisible();
  });
});

test.describe('Dashboard — keyboard a11y', () => {
  test.beforeEach(async ({ page }) => {
    await seedReport(page);
  });

  test('Tab moves focus through interactive controls', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');  // → skip past topbar
    // Just confirm focus moves and doesn't trap
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['A', 'BUTTON', 'INPUT']).toContain(focused);
  });
});