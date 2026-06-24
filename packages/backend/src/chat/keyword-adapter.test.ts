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
    expect(r.reply).toMatch(/Empty/);
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
