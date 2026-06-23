// tests/e2e/chat.spec.ts — /chat page + /api/chat route.
// Verifies keyword-matched scripted recommendations render with rule cards.

import { test, expect } from '@playwright/test';

test.describe('Chat page', () => {
  test('shows empty state with suggestions on first load', async ({ page }) => {
    await page.goto('/chat');
    await expect(page.getByRole('heading', { name: 'AI 规则助手' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '告诉我你想加强什么' })).toBeVisible();

    // 4 suggestion prompts (verbatim)
    await expect(page.getByRole('button', { name: /我想加强 SQL 注入检查/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /扫描项目里硬编码的密钥和凭证/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /TypeScript 项目里怎么防止/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /我们团队没有 ESLint/ })).toBeVisible();

    // Quick keyword pills
    for (const k of ['SQL', '密钥', 'TypeScript', '依赖', '测试', '文件', '架构', 'console.log']) {
      await expect(page.getByRole('button', { name: new RegExp(`^${k}$`) })).toBeVisible();
    }
  });

  test('sending a message renders user bubble + assistant reply', async ({ page }) => {
    await page.goto('/chat');
    const input = page.getByPlaceholder('输入消息');
    await input.fill('credential');
    await input.press('Enter');

    // User bubble on the right
    await expect(page.locator('.chat-message-user .chat-bubble')).toContainText('credential');
    // Assistant reply on the left
    await expect(page.locator('.chat-message-assistant .chat-bubble')).toBeVisible({ timeout: 10_000 });
  });

  test('recommendation cards appear for known keywords', async ({ page }) => {
    await page.goto('/chat');
    await page.getByPlaceholder('输入消息').fill('credential');
    await page.getByPlaceholder('输入消息').press('Enter');

    // The credential keyword should surface plaintext-credentials + 2 more
    await expect(page.locator('.chat-rec-card', { hasText: 'plaintext-credentials' })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.chat-rec-card', { hasText: 'git-no-secrets-in-history' })).toBeVisible();
  });

  test('install button toggles to 已启用 + uninstall', async ({ page }) => {
    await page.goto('/chat');
    // Clear any prior state from localStorage
    await page.evaluate(() => localStorage.removeItem('checkit:installed-rules'));
    await page.reload();

    await page.getByPlaceholder('输入消息').fill('credential');
    await page.getByPlaceholder('输入消息').press('Enter');

    const card = page.locator('.chat-rec-card', { hasText: 'plaintext-credentials' });
    await expect(card).toBeVisible({ timeout: 10_000 });
    const installBtn = card.getByRole('button', { name: /一键启用/ });
    await installBtn.click();
    // Now shows "已启用"
    await expect(card.getByText(/已启用/)).toBeVisible();
    // Uninstall appears
    await expect(card.getByRole('button', { name: '停用' })).toBeVisible();
  });

  test('rail tab Chat is highlighted', async ({ page }) => {
    await page.goto('/chat');
    await expect(page.locator('.rail-tab.active')).toHaveAttribute('aria-label', 'Chat');
  });

  test('chat history persists in localStorage across reloads', async ({ page }) => {
    await page.goto('/chat');
    await page.evaluate(() => localStorage.removeItem('checkit:chat-history'));
    await page.reload();

    // Send a message — user bubble appears synchronously (optimistic).
    await page.getByPlaceholder('输入消息').fill('TS');
    await page.getByPlaceholder('输入消息').press('Enter');
    await expect(page.locator('.chat-message-user')).toBeVisible({ timeout: 5_000 });

    // Reload and check localStorage still has the user message.
    await page.reload();
    const stored = await page.evaluate(() => localStorage.getItem('checkit:chat-history'));
    expect(stored).toBeTruthy();
    const history = JSON.parse(stored!);
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history.some((m: any) => m.role === 'user' && m.text === 'TS')).toBe(true);
  });

  test('clear history button resets', async ({ page }) => {
    await page.goto('/chat');
    await page.getByPlaceholder('输入消息').fill('TS');
    await page.getByPlaceholder('输入消息').press('Enter');
    await expect(page.locator('.chat-message-user')).toBeVisible({ timeout: 10_000 });

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '清空对话' }).click();
    // Wait for the empty state to reappear
    await expect(page.getByRole('heading', { name: '告诉我你想加强什么' })).toBeVisible();
  });
});

test.describe('API /api/chat', () => {
  test('returns reply + recommendations for credential', async ({ request: ctx }) => {
    const r = await ctx.post('/api/chat', {
      data: { message: 'credential' },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.reply).toMatch(/凭证|密钥/);
    expect(body.recommendations.length).toBeGreaterThan(0);
    const ids = body.recommendations.map((x: any) => x.id);
    expect(ids).toContain('plaintext-credentials');
  });

  test('returns default reply for unknown message', async ({ request: ctx }) => {
    const r = await ctx.post('/api/chat', { data: { message: 'qwerty uiop' } });
    const body = await r.json();
    expect(body.reply).toMatch(/关键词/);
    expect(body.recommendations.length).toBe(0);
    expect(body.recommendedSets.length).toBe(0);
  });

  test('TS keyword returns TypeScript rule bundle', async ({ request: ctx }) => {
    const r = await ctx.post('/api/chat', { data: { message: 'typescript strict mode' } });
    const body = await r.json();
    expect(body.recommendations.length).toBeGreaterThan(0);
    expect(body.recommendations.map((r: any) => r.id)).toContain('no-any-rule');
  });

  test('400 on empty message', async ({ request: ctx }) => {
    const r = await ctx.post('/api/chat', { data: { message: '' } });
    expect(r.status()).toBe(400);
  });
});