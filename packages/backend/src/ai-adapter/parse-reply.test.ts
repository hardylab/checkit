// packages/backend/src/ai-adapter/parse-reply.test.ts
//
// parseReply 是 internal — 通过 mock fetch 间接测试(OpenAI/Claude adapter)。

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// We need to import AFTER setting up fetch mock.
let parseReplyFromOpenai: typeof import('./openai.js')['makeOpenAIAdapter'];
let parseReplyFromClaude: typeof import('./claude.js')['makeClaudeAdapter'];

beforeEach(async () => {
  // dynamic import so we can swap fetch first
  const mod = await import('./openai.js');
  parseReplyFromOpenai = mod.makeOpenAIAdapter;
  const mod2 = await import('./claude.js');
  parseReplyFromClaude = mod2.makeClaudeAdapter;
});

describe('OpenAI adapter — error paths', () => {
  afterEach(() => { delete process.env.OPENAI_API_KEY; });

  it('throws with helpful message when no API key', async () => {
    const a = parseReplyFromOpenai();
    await expect(a.chat('hi', { cwd: '/x' })).rejects.toThrow(/missing API key/);
    await expect(a.chat('hi', { cwd: '/x' })).rejects.toThrow(/OPENAI_API_KEY/);
    await expect(a.chat('hi', { cwd: '/x' })).rejects.toThrow(/lintany config set ai.adapter local-keyword/);
  });

  it('exposes id and label', () => {
    const a = parseReplyFromOpenai();
    expect(a.id).toBe('openai');
    expect(a.label).toMatch(/^OpenAI \(/);
  });
});

describe('OpenAI adapter — parseReply (via fetch mock)', () => {
  let origFetch: typeof globalThis.fetch;
  beforeEach(() => {
    origFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = origFetch;
    delete process.env.OPENAI_API_KEY;
  });

  it('parses a clean JSON response', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    globalThis.fetch = (async (_url: string | URL | Request, _init?: RequestInit) => {
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          reply: 'Use TS strict.',
          suggestions: [{ id: 'no-any-rule', title: 'No Any Rule', tldr: 'avoid any' }],
          recommendedSets: [{ id: 'ts-strict', name: 'TS Strict', description: '...' }],
        }) }}],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;

    const a = parseReplyFromOpenai();
    const r = await a.chat('I want TS strict', { cwd: '/x' });
    expect(r.reply).toBe('Use TS strict.');
    expect(r.suggestions).toEqual([{ id: 'no-any-rule', title: 'No Any Rule', tldr: 'avoid any' }]);
    expect(r.recommendedSets).toEqual([{ id: 'ts-strict', name: 'TS Strict', description: '...' }]);
  });

  it('parses JSON wrapped in markdown fences', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({
        choices: [{ message: { content: '```json\n{"reply":"hi","suggestions":[],"recommendedSets":[]}\n```' }}],
      }), { status: 200 });
    }) as typeof fetch;

    const r = await parseReplyFromOpenai().chat('x', { cwd: '/x' });
    expect(r.reply).toBe('hi');
  });

  it('falls back to raw text when no JSON object is present', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'Sure, here you go.' }}],
      }), { status: 200 });
    }) as typeof fetch;

    const r = await parseReplyFromOpenai().chat('x', { cwd: '/x' });
    expect(r.reply).toBe('Sure, here you go.');
    expect(r.suggestions).toEqual([]);
  });

  it('surfaces HTTP error with status + body snippet', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    globalThis.fetch = (async () => {
      return new Response('rate limit', { status: 429, statusText: 'Too Many Requests' });
    }) as typeof fetch;

    await expect(parseReplyFromOpenai().chat('x', { cwd: '/x' })).rejects.toThrow(/HTTP 429/);
  });

  it('honors per-adapter apiKey override over env', async () => {
    process.env.OPENAI_API_KEY = 'sk-env';
    let sentAuth = '';
    globalThis.fetch = (async (_u, init) => {
      const h = (init?.headers as Record<string, string>) || {};
      sentAuth = h['Authorization'] || '';
      return new Response(JSON.stringify({
        choices: [{ message: { content: '{"reply":"ok","suggestions":[],"recommendedSets":[]}' }}],
      }), { status: 200 });
    }) as typeof fetch;

    await parseReplyFromOpenai({ apiKey: 'sk-override' }).chat('x', { cwd: '/x' });
    expect(sentAuth).toBe('Bearer sk-override');
  });
});

describe('Claude adapter — error paths', () => {
  afterEach(() => { delete process.env.ANTHROPIC_API_KEY; });

  it('throws with helpful message when no API key', async () => {
    const a = parseReplyFromClaude();
    await expect(a.chat('hi', { cwd: '/x' })).rejects.toThrow(/missing API key/);
    await expect(a.chat('hi', { cwd: '/x' })).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });

  it('exposes id and label', () => {
    const a = parseReplyFromClaude();
    expect(a.id).toBe('claude');
    expect(a.label).toMatch(/^Anthropic Claude \(/);
  });
});

describe('Claude adapter — parseReply (via fetch mock)', () => {
  let origFetch: typeof globalThis.fetch;
  beforeEach(() => { origFetch = globalThis.fetch; });
  afterEach(() => {
    globalThis.fetch = origFetch;
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('parses text block from content[]', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({
        content: [{ type: 'text', text: JSON.stringify({
          reply: 'Use security-baseline',
          suggestions: [{ id: 'plaintext-credentials' }],
          recommendedSets: [{ id: 'security-baseline', name: 'Security', description: 'cred scan' }],
        }) }],
      }), { status: 200 });
    }) as typeof fetch;

    const r = await parseReplyFromClaude().chat('credential leak', { cwd: '/x' });
    expect(r.reply).toBe('Use security-baseline');
    expect(r.suggestions).toHaveLength(1);
    expect(r.suggestions[0].id).toBe('plaintext-credentials');
  });

  it('sends x-api-key header', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-x';
    let sentHeader = '';
    globalThis.fetch = (async (_u, init) => {
      const h = (init?.headers as Record<string, string>) || {};
      sentHeader = h['x-api-key'] || '';
      return new Response(JSON.stringify({
        content: [{ type: 'text', text: '{"reply":"","suggestions":[],"recommendedSets":[]}' }],
      }), { status: 200 });
    }) as typeof fetch;

    await parseReplyFromClaude().chat('x', { cwd: '/x' });
    expect(sentHeader).toBe('sk-ant-x');
  });
});
