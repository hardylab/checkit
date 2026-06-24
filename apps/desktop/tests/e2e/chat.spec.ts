// tests/e2e/chat.spec.ts — chat view + /api/chat route.

import { test, expect } from '@playwright/test';
import { gotoView } from './helpers';

test.describe('Chat view', () => {
  test('shows empty state with suggestions on first load', async ({ page }) => {
    await gotoView(page, 'chat');
    await expect(page.getByRole('heading', { name: 'AI 规则助手' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '告诉我你想加强什么' })).toBeVisible();

    await expect(page.getByRole('button', { name: /我想加强 SQL 注入检查/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /扫描项目里硬编码的密钥和凭证/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /TypeScript 项目里怎么防止/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /我们团队没有 ESLint/ })).toBeVisible();

    for (const k of ['SQL', '密钥', 'TypeScript', '依赖', '测试', '文件', '架构', 'console.log']) {
      const btn = page.getByRole('button', { name: new RegExp(`^${k}$`) });
      await btn.scrollIntoViewIfNeeded();
      await expect(btn).toBeVisible();
    }
  });

  test('sending a message renders user bubble + assistant reply', async ({ page }) => {
    await gotoView(page, 'chat');
    const input = page.getByPlaceholder('输入消息');
    await input.fill('credential');
    await input.press('Enter');

    await expect(page.locator('.chat-message-user .chat-bubble')).toContainText('credential');
    await expect(page.locator('.chat-message-assistant .chat-bubble')).toBeVisible({ timeout: 10_000 });
  });

  test('recommendation cards appear for known keywords', async ({ page }) => {
    await gotoView(page, 'chat');
    await page.getByPlaceholder('输入消息').fill('credential');
    await page.getByPlaceholder('输入消息').press('Enter');

    await expect(page.locator('.chat-rec-card', { hasText: 'plaintext-credentials' })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.chat-rec-card', { hasText: 'git-no-secrets-in-history' })).toBeVisible();
  });

  test('install button toggles to 已启用 + uninstall', async ({ page }) => {
    await gotoView(page, 'chat');
    await page.evaluate(() => localStorage.removeItem('checkit:installed-rules'));
    await page.reload();
    await page.waitForSelector('[data-view="chat"]', { timeout: 5_000 });

    await page.getByPlaceholder('输入消息').fill('credential');
    await page.getByPlaceholder('输入消息').press('Enter');

    const card = page.locator('.chat-rec-card', { hasText: 'plaintext-credentials' });
    await expect(card).toBeVisible({ timeout: 10_000 });
    const installBtn = card.getByRole('button', { name: /一键启用/ });
    await installBtn.click();
    await expect(card.getByText(/已启用/)).toBeVisible();
    await expect(card.getByRole('button', { name: '停用' })).toBeVisible();
  });

  test('rail tab Chat is highlighted when on chat view', async ({ page }) => {
    await gotoView(page, 'chat');
    await expect(page.getByTestId('rail-tab-chat')).toHaveClass(/active/);
  });

  test('chat history persists in localStorage across reloads', async ({ page }) => {
    await gotoView(page, 'chat');
    await page.evaluate(() => localStorage.removeItem('checkit:chat-conversations'));
    await page.evaluate(() => localStorage.removeItem('checkit:chat-history'));
    await page.reload();
    await page.waitForSelector('[data-view="chat"]');

    await page.getByPlaceholder('输入消息').fill('TS');
    await page.getByPlaceholder('输入消息').press('Enter');
    await expect(page.locator('.chat-message-user')).toBeVisible({ timeout: 5_000 });

    await page.reload();
    const stored = await page.evaluate(() => localStorage.getItem('checkit:chat-conversations'));
    expect(stored).toBeTruthy();
    const data = JSON.parse(stored!);
    expect(Array.isArray(data)).toBe(true);
    // Find the conversation that contains the TS message
    const has = data.some((c: any) => Array.isArray(c.messages) && c.messages.some((m: any) => m.role === 'user' && m.text === 'TS'));
    expect(has).toBe(true);
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
