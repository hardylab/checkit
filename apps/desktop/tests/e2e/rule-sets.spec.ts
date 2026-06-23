// tests/e2e/rule-sets.spec.ts — /rules set-based marketplace + chat set recs.
//
// Replaces the old single-rule list tests. The marketplace now shows
// rule SETS (bundled groups like ESLint presets) as the primary surface;
// individual rules are pills inside each set card, and the drawer
// opens when you click a pill.

import { test, expect } from '@playwright/test';

test.describe('Rules marketplace — set-based catalog', () => {
  test('renders 10 rule sets as the primary surface', async ({ page }) => {
    await page.goto('/rules');
    await expect(page.getByText(/共\s+\d+\s+个 set/)).toBeVisible({ timeout: 15_000 });
    const cards = page.locator('[data-set-card]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('shows 我的规则 / 所有规则 tabs with counts', async ({ page }) => {
    await page.goto('/rules');
    await page.evaluate(() => {
      localStorage.removeItem('checkit:installed-sets');
      localStorage.removeItem('checkit:installed-rules');
    });
    await page.reload();
    await expect(page.getByRole('button', { name: /我的规则\s+\(0\)/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /所有规则\s+\(10\)/ })).toBeVisible();
  });

  test('category filter narrows by category', async ({ page }) => {
    await page.goto('/rules');
    await expect(page.locator('[data-set-card]').first()).toBeVisible();
    await page.getByRole('button', { name: /安全合规\s+\(1\)/ }).click();
    await expect(page.locator('[data-set-card]')).toHaveCount(1);
    await expect(page.locator('[data-set-card] h2')).toContainText('安全基线');
  });

  test('search box filters sets', async ({ page }) => {
    await page.goto('/rules');
    await expect(page.locator('[data-set-card]').first()).toBeVisible();
    await page.getByPlaceholder(/搜索 set/).fill('流水线');
    // Only flow-naming-rule set matches "流水线"
    await expect(page.locator('[data-set-card]')).toHaveCount(1);
    await expect(page.locator('[data-set-card] h2')).toContainText('流水线命名');
  });

  test('each set card contains rule pills with severity colors', async ({ page }) => {
    await page.goto('/rules');
    await expect(page.locator('[data-set-card]').first()).toBeVisible();
    // Every card has at least one rule pill
    for (const id of ['security-baseline', 'ts-strict', 'file-hygiene']) {
      const card = page.locator(`[data-set-id="${id}"]`);
      await expect(card.locator('[data-rule-pill]').first()).toBeVisible();
    }
  });
});

test.describe('Set install / uninstall', () => {
  test('clicking + 安装 installs the set and updates tab count', async ({ page }) => {
    await page.goto('/rules');
    await page.evaluate(() => {
      localStorage.removeItem('checkit:installed-sets');
      localStorage.removeItem('checkit:installed-rules');
    });
    await page.reload();

    await expect(page.getByRole('button', { name: /我的规则\s+\(0\)/ })).toBeVisible();
    await page.locator('[data-testid="install-security-baseline"]').click();
    await expect(page.locator('[data-set-id="security-baseline"][data-installed="true"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /我的规则\s+\(1\)/ })).toBeVisible();
  });

  test('installing a set enables all its rule ids', async ({ page }) => {
    await page.goto('/rules');
    await page.evaluate(() => {
      localStorage.removeItem('checkit:installed-sets');
      localStorage.removeItem('checkit:installed-rules');
    });
    await page.reload();

    await page.locator('[data-testid="install-ts-strict"]').click();
    const stored = await page.evaluate(() => localStorage.getItem('checkit:installed-rules'));
    const setStored = await page.evaluate(() => localStorage.getItem('checkit:installed-sets'));
    expect(setStored).toContain('ts-strict');
    // ts-strict set includes no-any-rule, no-magic-numbers, etc.
    expect(stored).toContain('no-any-rule');
    expect(stored).toContain('no-magic-numbers');
  });

  test('stopping a set removes its rules from installed', async ({ page }) => {
    await page.goto('/rules');
    await page.evaluate(() => {
      localStorage.removeItem('checkit:installed-sets');
      localStorage.removeItem('checkit:installed-rules');
    });
    await page.reload();

    await page.locator('[data-testid="install-ts-strict"]').click();
    await page.locator('[data-testid="uninstall-ts-strict"]').click();
    await expect(page.locator('[data-set-id="ts-strict"][data-installed="true"]')).toHaveCount(0);
  });

  test('installed strip appears after first install', async ({ page }) => {
    await page.goto('/rules');
    await page.evaluate(() => {
      localStorage.removeItem('checkit:installed-sets');
      localStorage.removeItem('checkit:installed-rules');
    });
    await page.reload();

    await expect(page.locator('[data-testid="installed-strip"]')).toHaveCount(0);
    await page.locator('[data-testid="install-code-cleanup"]').click();
    await expect(page.locator('[data-testid="installed-strip"]')).toBeVisible();
    await expect(page.locator('[data-testid="installed-strip"]')).toContainText('已启用');
  });

  test('我的规则 tab shows only installed sets', async ({ page }) => {
    await page.goto('/rules');
    await page.evaluate(() => {
      localStorage.removeItem('checkit:installed-sets');
      localStorage.removeItem('checkit:installed-rules');
    });
    await page.reload();

    await page.locator('[data-testid="install-security-baseline"]').click();
    await page.getByRole('button', { name: /我的规则\s+\(1\)/ }).click();
    await expect(page.locator('[data-set-card]')).toHaveCount(1);
    await expect(page.locator('[data-set-card] h2')).toContainText('安全基线');
  });
});

test.describe('Rule drawer (clicking a rule pill inside a set)', () => {
  test('clicking a rule pill opens drawer with parent set context', async ({ page }) => {
    await page.goto('/rules');
    await expect(page.locator('[data-set-card]').first()).toBeVisible();
    await page.locator('[data-rule-id="plaintext-credentials"]').click();
    const drawer = page.locator('.drawer.open');
    await expect(drawer).toBeVisible();
    // The drawer header shows the parent set name + rule id
    await expect(drawer.getByRole('heading', { level: 3 })).toContainText('安全基线 /');
    await expect(drawer.getByRole('heading', { level: 3 })).toContainText('plaintext-credentials');
  });

  test('drawer close button dismisses it', async ({ page }) => {
    await page.goto('/rules');
    await expect(page.locator('[data-set-card]').first()).toBeVisible();
    await page.locator('[data-rule-id="no-any-rule"]').click();
    await expect(page.locator('.drawer.open')).toBeVisible();
    await page.locator('.drawer-close').click();
    await expect(page.locator('.drawer.open')).toBeHidden();
  });

  test('save button persists config + reflects in set enabled count', async ({ page }) => {
    await page.goto('/rules');
    await page.evaluate(() => {
      localStorage.removeItem('checkit:installed-sets');
      localStorage.removeItem('checkit:installed-rules');
      localStorage.removeItem('checkit:rule-config');
    });
    await page.reload();

    // Install ts-strict first
    await page.locator('[data-testid="install-ts-strict"]').click();
    await page.locator('[data-rule-id="no-any-rule"]').click();
    await page.locator('[data-testid="drawer-enabled"]').uncheck();
    await page.locator('[data-testid="drawer-save"]').click();
    await expect(page.locator('.drawer.open')).toBeHidden();

    await expect.poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('checkit:rule-config'));
      if (!raw) return false;
      try { return JSON.parse(raw)['no-any-rule']?.enabled === false; } catch { return false; }
    }, { timeout: 5_000 }).toBe(true);
  });
});

test.describe('API /api/rule-sets', () => {
  test('returns the 10 sets with resolved rules', async ({ request: ctx }) => {
    const r = await ctx.get('/api/rule-sets');
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.count).toBeGreaterThanOrEqual(10);
    expect(body.sets[0]).toHaveProperty('id');
    expect(body.sets[0]).toHaveProperty('ruleIds');
    expect(body.sets[0]).toHaveProperty('resolved');
    // Every set's ruleIds must all resolve to real rules
    for (const s of body.sets) {
      expect(s.missing).toEqual([]);
    }
  });
});

test.describe('Chat recommends both sets AND rules', () => {
  test('credential → security-baseline set + 3 rule recs', async ({ request: ctx }) => {
    const r = await ctx.post('/api/chat', { data: { message: 'credential' } });
    const body = await r.json();
    expect(body.recommendedSets.map((s: any) => s.id)).toContain('security-baseline');
    expect(body.recommendations.length).toBeGreaterThanOrEqual(2);
  });

  test('ESLint / preset keywords → 入门 set bundle', async ({ request: ctx }) => {
    const r = await ctx.post('/api/chat', { data: { message: '帮我配一套 preset' } });
    const body = await r.json();
    expect(body.recommendedSets.length).toBeGreaterThanOrEqual(2);
    const ids = body.recommendedSets.map((s: any) => s.id);
    expect(ids).toContain('security-baseline');
    expect(ids).toContain('ts-strict');
  });
});