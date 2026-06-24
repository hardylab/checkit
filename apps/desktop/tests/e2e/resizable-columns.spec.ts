// tests/e2e/resizable-columns.spec.ts — column resize + persistence.
import { test, expect } from '@playwright/test';
import { gotoView } from './helpers';

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
  // Wait for React to flush the final setWidthState to the DOM
  // (state updates in mouseup handlers are batched in React 18+).
  await page.waitForFunction(
    () => {
      const w = parseInt(localStorage.getItem('checkit:layout') ?? '{}', 10);
      return !isNaN(w) && Object.keys(JSON.parse(localStorage.getItem('checkit:layout') ?? '{}')).length > 0;
    },
    { timeout: 1000 }
  ).catch(() => { /* may already be written */ });
}

test.describe('Column resizers', () => {
  test.beforeEach(async ({ page }) => {
    await gotoView(page, 'rules');
    await page.evaluate(() => localStorage.removeItem('checkit:layout'));
    await page.reload();
    await page.waitForSelector('.rules-side-eyebrow', { timeout: 10_000 });
  });

  test('side-rail resizer exists and is 8px wide (hit area) + absolute positioned', async ({ page }) => {
    await expect(page.locator('[data-resizer-for="side-rail"]')).toBeVisible();
    const box = await page.locator('[data-resizer-for="side-rail"]').boundingBox();
    // Hit area is 8px (4px visible bar in the middle, 3px padding each side).
    expect(box?.width).toBe(8);
    // It must NOT take flex space — absolute positioning only.
    const position = await page.locator('[data-resizer-for="side-rail"]').evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe('absolute');
    // The resizer must not push the side rail's right edge past its declared width.
    const rail = await page.locator('.rules-side-rail').boundingBox();
    const resizer = await page.locator('[data-resizer-for="side-rail"]').boundingBox();
    // Resizer sits at right:0 of the rail — its left edge is 4px inside the rail.
    expect(Math.round(rail!.x + rail!.width - resizer!.x)).toBe(8);
  });

  test('resizer is transparent by default and only highlights on hover', async ({ page }) => {
    const resizer = page.locator('[data-resizer-for="side-rail"]');
    // Default state — the pseudo-element ::before is fully transparent.
    // Browsers normalize this to either rgba(0,0,0,0) or oklab(0 0 0 / 0).
    const defaultBg = await resizer.evaluate((el) => getComputedStyle(el, '::before').backgroundColor);
    expect(defaultBg).toMatch(/rgba\(0, 0, 0, 0\)|oklab\(0 0 0 \/ 0\)|transparent/);

    // On hover — the pseudo-element becomes the sage-green accent.
    // It must no longer be fully transparent, but the exact color
    // depends on the browser (rgb / oklch / oklab).
    await resizer.hover();
    const hoverBg = await resizer.evaluate((el) => getComputedStyle(el, '::before').backgroundColor);
    expect(hoverBg).not.toMatch(/rgba\(0, 0, 0, 0\)|oklab\(0 0 0 \/ 0\)|transparent/);
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

  test('resizers do not take flex space (overlap column borders, no width stolen)', async ({ page }) => {
    await page.getByTestId('cat-security').click();
    await page.getByTestId('set-security-baseline').click();

    // Both columns render their declared widths with no extra room for resizers.
    const railW = await page.evaluate(() => document.querySelector('.rules-side-rail').getBoundingClientRect().width);
    const ruleW = await page.evaluate(() => document.querySelector('[data-testid="rule-pane"]').getBoundingClientRect().width);
    const shellW = await page.evaluate(() => document.querySelector('.rules-shell').getBoundingClientRect().width);

    // Market-main is flex: 1 1 auto, so it fills shell minus side rail width.
    const marketW = await page.evaluate(() => document.querySelector('.rules-market-main').getBoundingClientRect().width);
    expect(marketW).toBeCloseTo(shellW - railW, 0);

    // Market-main contains set-pane (flex 1) + rule-pane (fixed width).
    // Their sum must equal market-main's width — resizers do NOT contribute.
    const setPaneW = await page.evaluate(() => document.querySelector('.rules-set-pane').getBoundingClientRect().width);
    expect(setPaneW + ruleW).toBeCloseTo(marketW, 0);
  });

  test('dragging side-rail resizer right widens the side rail', async ({ page }) => {
    const before = await page.evaluate(() => document.querySelector('.rules-side-rail')!.getBoundingClientRect().width);
    await dragResizer(page, 'side-rail', 60);
    await expect.poll(async () => page.evaluate(() => document.querySelector('.rules-side-rail')!.getBoundingClientRect().width), { timeout: 2_000 }).toBeGreaterThan(before);
    const after = await page.evaluate(() => document.querySelector('.rules-side-rail')!.getBoundingClientRect().width);
    // Should be ~300 (default 240 + 60)
    expect(Math.round(after)).toBeGreaterThanOrEqual(298);
    expect(Math.round(after)).toBeLessThanOrEqual(305);
  });

  test('dragging side-rail resizer left narrows but clamps at min (160)', async ({ page }) => {
    await dragResizer(page, 'side-rail', -200); // way past min
    await expect.poll(async () => page.evaluate(() => Math.round(document.querySelector('.rules-side-rail')!.getBoundingClientRect().width)), { timeout: 2_000 }).toBeLessThanOrEqual(165);
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
    await page.waitForSelector('[data-resizer-for="side-rail"]', { timeout: 10_000 });
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
    await page.waitForSelector('.rules-side-eyebrow', { timeout: 10_000 });
    const sideRail = await page.evaluate(() => document.querySelector('.rules-side-rail')!.getBoundingClientRect().width);
    await page.getByTestId('cat-security').click();
    await page.getByTestId('set-security-baseline').click();
    const rulePane = await page.evaluate(() => document.querySelector('[data-testid="rule-pane"]')!.getBoundingClientRect().width);
    expect(Math.round(sideRail)).toBe(stored['side-rail']);
    expect(Math.round(rulePane)).toBe(stored['rule-pane']);
  });
});