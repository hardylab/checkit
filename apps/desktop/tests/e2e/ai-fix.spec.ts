// tests/e2e/ai-fix.spec.ts — /ai-fix page rendering + interactions.

import { test, expect, type Page } from '@playwright/test';

const SAMPLE = {
  issues: [
    {
      type: 'security', module: 'plaintext-credentials',
      file: 'src/api/auth.ts', line: 42,
      issue: 'AWS Access Key hardcoded',
      expect: 'Move AWS_ACCESS_KEY_ID to env var or KMS',
      level: 'error', fixable: true,
    },
    {
      type: 'structure', module: 'no-console-log',
      file: 'src/main.ts', line: 7,
      issue: 'console.log detected',
      expect: 'Remove the console.log call',
      level: 'warning', fixable: true,
    },
  ],
  source: 'demo-report.json',
};

async function seedAndGotoAiFix(page: Page, idx = 0) {
  await page.addInitScript((report) => {
    localStorage.setItem('checkit:last-report', JSON.stringify(report));
  }, SAMPLE);
  await page.goto(`/ai-fix?idx=${idx}&file=demo-report.json`);
}

test.describe('AI-fix page', () => {
  test('renders the selected issue + plan + impact estimate', async ({ page }) => {
    await seedAndGotoAiFix(page, 0);
    await expect(page.locator('.ai-fix-page')).toBeVisible();

    // Sidebar
    await expect(page.locator('h4', { hasText: '问题诊断' })).toBeVisible();
    await expect(page.getByText('AWS Access Key hardcoded')).toBeVisible();
    await expect(page.locator('.pill-warn, .pill-error').first()).toBeVisible();

    // Plan section
    await expect(page.locator('h4', { hasText: 'AI 计划' })).toBeVisible();
    await expect(page.locator('ol li').first()).toBeVisible();

    // Impact grid
    await expect(page.locator('h4', { hasText: '影响估算' })).toBeVisible();
  });

  test('patch header shows file path + +/- counts', async ({ page }) => {
    await seedAndGotoAiFix(page, 0);
    await expect(page.locator('.patch-file')).toContainText('src/api/auth.ts');
    await expect(page.locator('.patch-stats .add')).toContainText('+');
    await expect(page.locator('.patch-stats .del')).toContainText('−');
  });

  test('diff table renders unified by default', async ({ page }) => {
    await seedAndGotoAiFix(page, 0);
    await expect(page.locator('.diff-table')).toBeVisible();
    await expect(page.locator('.patch-toggle button.active')).toHaveText('Unified');
    // Has at least one add or del row
    const rows = page.locator('.diff-table tr');
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('clicking Split toggle switches mode', async ({ page }) => {
    await seedAndGotoAiFix(page, 0);
    await page.getByRole('button', { name: 'Split' }).click();
    await expect(page.locator('.patch-toggle button.active')).toHaveText('Split');
  });

  test('clicking Unified toggle after Split restores unified view', async ({ page }) => {
    await seedAndGotoAiFix(page, 0);
    await page.getByRole('button', { name: 'Split' }).click();
    await page.getByRole('button', { name: 'Unified' }).click();
    await expect(page.locator('.patch-toggle button.active')).toHaveText('Unified');
  });

  test('back link returns to dashboard with report loaded', async ({ page }) => {
    await seedAndGotoAiFix(page, 0);
    await page.getByRole('link', { name: '← 返回主控台' }).click();
    await page.waitForURL(/\/$/);
    // Returns to dashboard view (not dropzone), since localStorage still
    // holds the report. This is correct UX — user goes back to see context.
    await expect(page.locator('.dash')).toBeVisible();
    await expect(page.locator('.issue-row')).toHaveCount(2);
  });

  test('reject link returns to dashboard with report loaded', async ({ page }) => {
    await seedAndGotoAiFix(page, 0);
    await page.getByRole('link', { name: '拒绝' }).click();
    await page.waitForURL(/\/$/);
    await expect(page.locator('.dash')).toBeVisible();
  });

  test('missing idx shows placeholder + back CTA', async ({ page }) => {
    await page.addInitScript((report) => {
      localStorage.setItem('checkit:last-report', JSON.stringify(report));
    }, SAMPLE);
    await page.goto('/ai-fix?idx=99&file=foo.json');
    await expect(page.getByRole('heading', { name: '找不到这个问题' })).toBeVisible();
    await expect(page.getByRole('link', { name: '回到主控台' })).toBeVisible();
  });

  test('copy patch button clicks without error', async ({ page }) => {
    await seedAndGotoAiFix(page, 0);
    const copyBtn = page.getByRole('button', { name: /复制 Patch/ });
    // Granting clipboard permission doesn't help in headless chrome
    // because navigator.clipboard.writeText requires a secure context
    // and a user gesture. Just verify the click doesn't throw and that
    // a `.catch` noop keeps the page stable.
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();
    // Page still rendered (no exception broke React)
    await expect(page.locator('.ai-fix-page')).toBeVisible();
  });

  test('apply patch button triggers Electron IPC (or alert in dev)', async ({ page }) => {
    await seedAndGotoAiFix(page, 0);
    // Outside Electron, the handler just shows an alert
    page.once('dialog', (d) => {
      expect(d.message()).toContain('AI agent');
      d.dismiss();
    });
    await page.getByRole('button', { name: '应用补丁' }).click();
  });
});