// packages/backend/src/config/commands.test.ts — config test command
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

// We need to control process.env.HOME so global.ts picks up our temp dir.
let fakeHome: string;

beforeEach(() => {
  fakeHome = fs.mkdtempSync(path.join(tmpdir(), 'lintany-test-'));
  process.env.HOME = fakeHome;
  process.env.USERPROFILE = fakeHome;
  // Unset real provider keys so auto-promote doesn't kick in.
  delete process.env.MINIMAX_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
});

afterEach(() => {
  fs.rmSync(fakeHome, { recursive: true, force: true });
  delete process.env.HOME;
  delete process.env.USERPROFILE;
});

describe('cmdConfigTest — local-keyword (no LLM call)', () => {
  it('returns ok=true for local-keyword', async () => {
    const { cmdConfigTest } = await import('./commands.js');
    const captures: string[] = [];
    const origLog = console.log;
    console.log = (s) => captures.push(String(s));
    try {
      await cmdConfigTest(['--json'], fakeHome);
    } finally {
      console.log = origLog;
    }
    const last = JSON.parse(captures[captures.length - 1] ?? '{}');
    expect(last.ok).toBe(true);
    expect(last.adapter).toBe('local-keyword');
  });

  it('returns ok=true even with no config (default is local-keyword)', async () => {
    const { cmdConfigTest } = await import('./commands.js');
    const captures: string[] = [];
    const origLog = console.log;
    console.log = (s) => captures.push(String(s));
    try {
      await cmdConfigTest(['--json'], fakeHome);
    } finally {
      console.log = origLog;
    }
    const last = JSON.parse(captures[captures.length - 1] ?? '{}');
    expect(last.ok).toBe(true);
    expect(last.adapter).toBe('local-keyword');
  });
});

describe('cmdConfigTest — bad credentials', () => {
  it('returns ok=false for OpenAI-compatible with fake key (no network: error path)', async () => {
    // Set up a config pointing at a non-existent host so we don't actually
    // hit the network — verifies the error path of the adapter.
    const cfgDir = path.join(fakeHome, '.checkit');
    fs.mkdirSync(cfgDir, { recursive: true });
    fs.writeFileSync(path.join(cfgDir, 'config.json'), JSON.stringify({
      ai: { adapter: 'openai', api_key: 'sk-fake', base_url: 'http://127.0.0.1:1/v1', model: 'gpt-4o-mini' },
    }));
    const { cmdConfigTest } = await import('./commands.js');
    // Capture stdout + exit code. The command uses die() which throws.
    let exitCode = 0;
    let captured = '';
    const origLog = console.log;
    const origError = console.error;
    const origExit = process.exit;
    process.exit = ((code: number) => { exitCode = code; throw new Error(`exit ${code}`); }) as never;
    console.log = (s) => { captured += String(s) + '\n'; };
    console.error = (s) => { captured += String(s) + '\n'; };
    try {
      try { await cmdConfigTest(['--json'], fakeHome); } catch { /* expected exit */ }
    } finally {
      console.log = origLog;
      console.error = origError;
      process.exit = origExit;
    }
    expect(exitCode).not.toBe(0);
    expect(captured).toMatch(/ok.*false/);
  });
});
