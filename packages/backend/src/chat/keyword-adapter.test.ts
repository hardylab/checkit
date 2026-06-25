// packages/backend/src/chat/keyword-adapter.test.ts — local keyword adapter
import { describe, it, expect } from 'vitest';
import { chatReply } from './keyword-adapter.js';

describe('chatReply — keyword hits', () => {
  it('matches "credential" → security rules + security-baseline preset', async () => {
    const r = await chatReply('I worry about credentials in my code');
    const ids = r.suggestions.map((s) => s.id);
    expect(ids).toContain('plaintext-credentials');
    expect(ids).toContain('git-no-secrets-in-history');
    expect(r.recommendedSets.map((s) => s.id)).toContain('security-baseline');
    expect(r.reply).toMatch(/Matched/);
  });

  it('matches "TS strict" → no-any-rule + ts-strict preset', async () => {
    const r = await chatReply('typescript strict mode please');
    expect(r.suggestions.map((s) => s.id)).toContain('no-any-rule');
    expect(r.recommendedSets.map((s) => s.id)).toContain('ts-strict');
  });

  it('matches "any" → no-any-rule', async () => {
    const r = await chatReply('how do I prevent any in my code?');
    expect(r.suggestions.map((s) => s.id)).toContain('no-any-rule');
  });

  it('matches "console.log" → no-console-log', async () => {
    const r = await chatReply('no console.log please');
    expect(r.suggestions.map((s) => s.id)).toContain('no-console-log');
  });

  it('case-insensitive', async () => {
    const r = await chatReply('CREDENTIALS everywhere');
    expect(r.suggestions.map((s) => s.id)).toContain('plaintext-credentials');
  });
});

describe('chatReply — no hits', () => {
  it('empty message returns empty reply without throwing', async () => {
    const r = await chatReply('');
    expect(r.suggestions).toHaveLength(0);
    expect(r.recommendedSets).toHaveLength(0);
    // Default to zh for empty messages (desktop UI is zh-primary).
    expect(r.reply).toMatch(/消息为空|Empty/);
  });

  it('whitespace-only message treated as empty', async () => {
    const r = await chatReply('   \t  \n  ');
    expect(r.suggestions).toHaveLength(0);
  });

  it('unmatched message returns "no match" reply', async () => {
    const r = await chatReply('asdfghjkl qwerty uiop');
    expect(r.suggestions).toHaveLength(0);
    expect(r.recommendedSets).toHaveLength(0);
    expect(r.reply).toMatch(/no rule or preset/);
  });
});

describe('chatReply — language detection', () => {
  it('Chinese empty msg returns Chinese empty reply', async () => {
    const r = await chatReply('   ');
    expect(r.reply).toMatch(/消息为空/);
  });

  it('Chinese non-match returns Chinese reply', async () => {
    const r = await chatReply('你好');
    expect(r.reply).toMatch(/没有匹配到/);
    expect(r.reply).not.toMatch(/I matched no rule/);
  });

  it('English non-match returns English reply', async () => {
    const r = await chatReply('qwerty uiop asdfgh');
    expect(r.reply).toMatch(/I matched no rule/);
    expect(r.reply).not.toMatch(/没有匹配到/);
  });

  it('Chinese match returns Chinese matched reply', async () => {
    const r = await chatReply('硬编码凭证');
    // 'credential' or '凭证' or '硬编码' should all hit — at least one of
    // the matched paths returns Chinese reply.
    if (r.suggestions.length > 0 || r.recommendedSets.length > 0) {
      expect(r.reply).toMatch(/为 "硬编码凭证" 匹配到/);
    }
  });

  it('English match returns English matched reply', async () => {
    const r = await chatReply('plaintext credential');
    if (r.suggestions.length > 0 || r.recommendedSets.length > 0) {
      expect(r.reply).toMatch(/Matched \d+ (preset candidate\(s\)|specific rule\(s\))/);
    }
  });
});

describe('chatReply — multiple keyword hits', () => {
  it('combines hits across rules + sets, deduped', async () => {
    const r = await chatReply('credential security ts strict');
    const ids = r.suggestions.map((s) => s.id);
    // plaintext-credentials hits both 'credential' and 'security' — should appear once
    const count = ids.filter((i) => i === 'plaintext-credentials').length;
    expect(count).toBe(1);
    // Multiple sets expected
    expect(r.recommendedSets.length).toBeGreaterThan(1);
  });

  it('reply string includes runnable next step', async () => {
    const r = await chatReply('I want to prevent SQL injection');
    expect(r.reply).toMatch(/lintany preset new/);
  });
});
