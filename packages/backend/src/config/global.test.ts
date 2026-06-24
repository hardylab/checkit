// packages/backend/src/config/global.test.ts — global config file CRUD
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  parseKey,
  parseValue,
  setConfig,
  getConfig,
  listConfig,
  unsetConfig,
  configFilePath,
  formatValue,
} from './global.js';

let tmpDir: string;
let origHome: string | undefined;
let origUserProfile: string | undefined;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lintany-cfg-'));
  origHome = process.env.HOME;
  origUserProfile = process.env.USERPROFILE;
  process.env.HOME = tmpDir;
  process.env.USERPROFILE = tmpDir;
});

afterEach(() => {
  if (origHome !== undefined) process.env.HOME = origHome;
  else delete process.env.HOME;
  if (origUserProfile !== undefined) process.env.USERPROFILE = origUserProfile;
  else delete process.env.USERPROFILE;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('parseKey', () => {
  it('splits dot-path', () => {
    expect(parseKey('a.b.c')).toEqual(['a', 'b', 'c']);
  });

  it('single segment', () => {
    expect(parseKey('theme')).toEqual(['theme']);
  });

  it('rejects empty', () => {
    expect(() => parseKey('')).toThrow(/non-empty/);
  });

  it('rejects leading dot', () => {
    expect(() => parseKey('.theme')).toThrow(/invalid dot-path/);
  });

  it('rejects trailing dot', () => {
    expect(() => parseKey('theme.')).toThrow(/invalid dot-path/);
  });

  it('rejects double dot', () => {
    expect(() => parseKey('a..b')).toThrow(/invalid dot-path/);
  });

  it('rejects empty segment', () => {
    expect(() => parseKey('a..b')).toThrow();
  });
});

describe('parseValue', () => {
  it('boolean true/false', () => {
    expect(parseValue('true')).toBe(true);
    expect(parseValue('false')).toBe(false);
  });

  it('null literal', () => {
    expect(parseValue('null')).toBeNull();
  });

  it('integers and floats', () => {
    expect(parseValue('42')).toBe(42);
    expect(parseValue('-3.14')).toBeCloseTo(-3.14);
  });

  it('JSON object', () => {
    expect(parseValue('{"a":1}')).toEqual({ a: 1 });
  });

  it('JSON array', () => {
    expect(parseValue('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('raw string fallback', () => {
    expect(parseValue('hello world')).toBe('hello world');
  });

  it('looks-like-JSON but invalid → raw string', () => {
    expect(parseValue('{bad')).toBe('{bad');
  });
});

describe('config CRUD — basic', () => {
  it('configFilePath respects HOME override', () => {
    expect(configFilePath()).toBe(path.join(tmpDir, '.checkit', 'config.json'));
  });

  it('set + get round-trip primitives', () => {
    setConfig('theme', 'dark');
    setConfig('count', 42);
    setConfig('enabled', true);
    expect(getConfig('theme').value).toBe('dark');
    expect(getConfig('count').value).toBe(42);
    expect(getConfig('enabled').value).toBe(true);
  });

  it('set creates intermediate objects', () => {
    setConfig('ai.adapter', 'openai');
    expect(getConfig('ai.adapter').value).toBe('openai');
    const raw = JSON.parse(fs.readFileSync(configFilePath(), 'utf-8'));
    expect(raw).toEqual({ ai: { adapter: 'openai' } });
  });

  it('get missing key returns found:false', () => {
    const r = getConfig('nonexistent');
    expect(r.found).toBe(false);
    expect(r.value).toBeUndefined();
  });

  it('get partial path returns found:false', () => {
    setConfig('a.b', 'x');
    expect(getConfig('a.c').found).toBe(false);
  });

  it('set refuses when path collides with non-object', () => {
    setConfig('theme', 'dark');
    expect(() => setConfig('theme.sub', 'nope')).toThrow(/not an object/);
  });
});

describe('config CRUD — list', () => {
  it('empty file returns empty list', () => {
    expect(listConfig()).toEqual([]);
  });

  it('lists flat keys', () => {
    setConfig('theme', 'dark');
    setConfig('locale', 'zh-CN');
    expect(listConfig().sort()).toEqual(['locale', 'theme']);
  });

  it('lists nested keys as dot-paths, sorted', () => {
    setConfig('ai.adapter', 'openai');
    setConfig('ai.model', 'gpt-4o');
    setConfig('theme', 'dark');
    expect(listConfig()).toEqual(['ai.adapter', 'ai.model', 'theme']);
  });
});

describe('config CRUD — unset', () => {
  it('unset leaf removes key', () => {
    setConfig('theme', 'dark');
    expect(unsetConfig('theme')).toBe(true);
    expect(getConfig('theme').found).toBe(false);
  });

  it('unset returns false when key absent', () => {
    expect(unsetConfig('never-set')).toBe(false);
  });

  it('unset cleans empty parent objects', () => {
    setConfig('ai.adapter', 'openai');
    expect(unsetConfig('ai.adapter')).toBe(true);
    expect(getConfig('ai').found).toBe(false); // parent also gone
    const raw = JSON.parse(fs.readFileSync(configFilePath(), 'utf-8'));
    expect(raw).toEqual({});
  });

  it('unset parent when only one child left', () => {
    setConfig('ai.adapter', 'openai');
    setConfig('theme', 'dark');
    expect(unsetConfig('ai')).toBe(true);
    const raw = JSON.parse(fs.readFileSync(configFilePath(), 'utf-8'));
    expect(raw).toEqual({ theme: 'dark' });
  });

  it('unset preserves sibling keys', () => {
    setConfig('ai.adapter', 'openai');
    setConfig('ai.model', 'gpt-4o');
    unsetConfig('ai.adapter');
    expect(getConfig('ai.model').value).toBe('gpt-4o');
    expect(getConfig('ai.adapter').found).toBe(false);
  });
});

describe('formatValue', () => {
  it('primitives', () => {
    expect(formatValue('hello')).toBe('hello');
    expect(formatValue(null)).toBe('null');
    expect(formatValue(42)).toBe('42');
    expect(formatValue(true)).toBe('true');
  });

  it('objects and arrays', () => {
    expect(formatValue({ a: 1 })).toBe('{"a":1}');
    expect(formatValue([1, 2])).toBe('[1,2]');
  });
});

describe('config CRUD — atomic writes', () => {
  it('no .tmp files left after writes', () => {
    setConfig('theme', 'dark');
    const dir = path.dirname(configFilePath());
    const tmps = fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'));
    expect(tmps).toEqual([]);
  });
});
