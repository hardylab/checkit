// tests/e2e/resizable-columns.spec.ts — column resize + persistence.
import { test, expect } from '@playwright/test';

async function dragResizer(
  page: import('@playwright/test').Page,
  resizerKey: string,
  deltaX: number,
) {
  const resizer = page.locator(`[data-resizer-for="${resizerKey}"]`);
  const box = await resizer.boundingBox();
  if (!box) throw new Error(`resizer ${resizerKey} not found`);
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(50);
}

test.describe('Column resizers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rules');
    await page.evaluate(() => localStorage.removeItem('checkit:layout'));
    await page.reload();
  });

  test('side-rail resizer exists and is 4px wide', async ({ page }) => {
    await expect(page.locator('[data-resizer-for="side-rail"]')).toBeVisible();
    const box = await page.locator('[data-resizer-for="side-rail"]').boundingBox();
    expect(box?.width).toBe(4);
  });

  test('rule-pane resizer appears when a set is selected', async ({ page }) => {
    // No resizer visible initially — rule-pane is hidden
    await expect(page.locator('[data-resizer-for="rule-pane"]')).toHaveCount(0);
    // Select category + set to reveal rule pane
    await page.getByTestId('cat-security').click();
    await page.getByTestId('set-security-baseline').click();
    await expect(page.locator('[data-testid="rule-pane"]')).toBeVisible();
    await expect(page.locator('[data-resizer-for="rule-pane"]')).toBeVisible();
  });

  test('dragging side-rail resizer right widens the side rail', async ({ page }) => {
    const before = await page.evaluate(() => document.querySelector('.rules-side-rail')!.getBoundingClientRect().width);
    await dragResizer(page, 'side-rail', 60);
    const after = await page.evaluate(() => document.querySelector('.rules-side-rail')!.getBoundingClientRect().width);
    expect(after).toBeGreaterThan(before);
    // Should be ~300 (default 240 + 60)
    expect(Math.round(after)).toBeGreaterThanOrEqual(298);
    expect(Math.round(after)).toBeLessThanOrEqual(305);
  });

  test('dragging side-rail resizer left narrows but clamps at min (160)', async ({ page }) => {
    await dragResizer(page, 'side-rail', -200); // way past min
    const w = await page.evaluate(() => document.querySelector('.rules-side-rail')!.getBoundingClientRect().width);
    expect(Math.round(w)).toBeGreaterThanOrEqual(160);
    expect(Math.round(w)).toBeLessThanOrEqual(165);
  });

  test('side-rail width persists to localStorage', async ({ page }) => {
    await dragResizer(page, 'side-rail', 50);
    const stored = await page.evaluate(() => localStorage.getItem('checkit:layout'));
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed['side-rail']).toBeGreaterThan(240);
    expect(parsed['side-rail']).toBeLessThanOrEqual(300);
  });

  test('side-rail width survives page reload', async ({ page }) => {
    await dragResizer(page, 'side-rail', 50);
    const widthBefore = await page.evaluate(() => document.querySelector('.rules-side-rail')!.getBoundingClientRect().width);
    await page.reload();
    await page.waitForSelector('[data-resizer-for="side-rail"]');
    const widthAfter = await page.evaluate(() => document.querySelector('.rules-side-rail')!.getBoundingClientRect().width);
    expect(Math.abs(widthBefore - widthAfter)).toBeLessThan(2);
  });

  test('rule-pane width persists too', async ({ page }) => {
    await page.getByTestId('cat-security').click();
    await page.getByTestId('set-security-baseline').click();
    await dragResizer(page, 'rule-pane', -80); // drag left to widen (right-side resizer)
    const w = await page.evaluate(() => document.querySelector('[data-testid="rule-pane"]')!.getBoundingClientRect().width);
    expect(Math.round(w)).toBeGreaterThanOrEqual(430);
    expect(Math.round(w)).toBeLessThanOrEqual(445);

    const stored = await page.evaluate(() => localStorage.getItem('checkit:layout'));
    const parsed = JSON.parse(stored!);
    expect(parsed['rule-pane']).toBeGreaterThan(360);
  });

  test('each column has its own persisted width (independent)', async ({ page }) => {
    await dragResizer(page, 'side-rail', 30);
    await page.getByTestId('cat-security').click();
    await page.getByTestId('set-security-baseline').click();
    await dragResizer(page, 'rule-pane', -60);

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('checkit:layout') ?? '{}'));
    expect(stored['side-rail']).toBeGreaterThan(240);
    expect(stored['rule-pane']).toBeGreaterThan(360);

    // Reload — both persist independently
    await page.reload();
    const sideRail = await page.evaluate(() => document.querySelector('.rules-side-rail')!.getBoundingClientRect().width);
    await page.getByTestId('cat-security').click();
    await page.getByTestId('set-security-baseline').click();
    const rulePane = await page.evaluate(() => document.querySelector('[data-testid="rule-pane"]')!.getBoundingClientRect().width);
    expect(Math.round(sideRail)).toBe(stored['side-rail']);
    expect(Math.round(rulePane)).toBe(stored['rule-pane']);
  });
});