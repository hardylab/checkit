// tests/e2e/ai-fix.spec.ts — ai-fix view rendering + interactions.

import { test, expect, type Page } from '@playwright/test';
import { gotoDirectView } from './helpers';

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
  await gotoDirectView(page, 'ai-fix', {
    'checkit:last-report': SAMPLE,
    'checkit:view': { id: 'ai-fix', idx, file: 'demo-report.json' },
  });
}

test.describe('AI-fix view', () => {
  test('renders the selected issue + plan + impact estimate', async ({ page }) => {
    await seedAndGotoAiFix(page, 0);
    await expect(page.locator('.ai-fix-page')).toBeVisible();

    await expect(page.locator('h4', { hasText: '问题诊断' })).toBeVisible();
    await expect(page.getByText('AWS Access Key hardcoded')).toBeVisible();
    await expect(page.locator('.pill-warn, .pill-error').first()).toBeVisible();

    await expect(page.locator('h4', { hasText: 'AI 计划' })).toBeVisible();
    await expect(page.locator('ol li').first()).toBeVisible();

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

  test('back button returns to dashboard with report loaded', async ({ page }) => {
    await seedAndGotoAiFix(page, 0);
    await page.getByRole('button', { name: '← 返回主控台' }).click();
    await page.waitForSelector('[data-view="dashboard"]', { timeout: 5_000 });
    await expect(page.locator('.dash')).toBeVisible();
    await expect(page.locator('.issue-row')).toHaveCount(2);
  });

  test('reject button returns to dashboard with report loaded', async ({ page }) => {
    await seedAndGotoAiFix(page, 0);
    await page.getByRole('button', { name: '拒绝' }).click();
    await page.waitForSelector('[data-view="dashboard"]', { timeout: 5_000 });
    await expect(page.locator('.dash')).toBeVisible();
  });

  test('missing idx shows placeholder + back CTA', async ({ page }) => {
    await page.addInitScript((report) => {
      localStorage.setItem('checkit:last-report', JSON.stringify(report));
      localStorage.setItem('checkit:view', JSON.stringify({ id: 'ai-fix', idx: 99, file: 'foo.json' }));
    }, SAMPLE);
    await page.goto('/');
    await page.waitForSelector('[data-view="ai-fix"]', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: '找不到这个问题' })).toBeVisible();
    await expect(page.getByRole('button', { name: '回到主控台' })).toBeVisible();
  });

  test('copy patch button clicks without error', async ({ page }) => {
    await seedAndGotoAiFix(page, 0);
    const copyBtn = page.getByRole('button', { name: /复制 Patch/ });
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();
    await expect(page.locator('.ai-fix-page')).toBeVisible();
  });

  test('apply patch button triggers Electron IPC (or alert in dev)', async ({ page }) => {
    await seedAndGotoAiFix(page, 0);
    page.once('dialog', (d) => {
      expect(d.message()).toContain('AI agent');
      d.dismiss();
    });
    await page.getByRole('button', { name: '应用补丁' }).click();
  });
});
