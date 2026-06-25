// packages/backend/src/custom-provider/store.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  listCustomProviders,
  readCustomProvider,
  writeCustomProvider,
  deleteCustomProvider,
  slugify,
} from './store.js';

let fakeHome: string;
beforeEach(() => {
  fakeHome = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'lintany-cp-'));
  process.env.HOME = fakeHome;
  process.env.USERPROFILE = fakeHome;
});
afterEach(() => {
  fs.rmSync(fakeHome, { recursive: true, force: true });
  delete process.env.HOME;
  delete process.env.USERPROFILE;
});

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('DeepSeek')).toBe('deepseek');
    expect(slugify('My Provider')).toBe('my-provider');
  });
  it('strips non-alphanumerics and collapses repeated hyphens', () => {
    expect(slugify('My___Provider 2!')).toBe('my-provider-2');
    expect(slugify('---foo---')).toBe('foo');
  });
  it('returns empty for all-symbol input', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('writeCustomProvider / readCustomProvider / list', () => {
  it('writes and reads a provider', () => {
    const p = writeCustomProvider({
      id: 'deepseek',
      name: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/',
      defaultModel: 'deepseek-v4-pro',
    }, fakeHome);
    expect(p.id).toBe('deepseek');
    expect(p.createdAt).toBeDefined();
    expect(p.updatedAt).toBeDefined();
    expect(readCustomProvider('deepseek', fakeHome)).toEqual(p);
  });

  it('lists providers sorted by name', () => {
    writeCustomProvider({ id: 'doubao',  name: '豆包',  baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', defaultModel: 'ep' }, fakeHome);
    writeCustomProvider({ id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/', defaultModel: 'deepseek-v4-pro' }, fakeHome);
    const list = listCustomProviders(fakeHome);
    expect(list.map((p) => p.id)).toEqual(['doubao', 'deepseek']);
  });

  it('updates timestamp on overwrite, preserves createdAt', () => {
    const first = writeCustomProvider({ id: 'x', name: 'X', baseUrl: 'https://x/', defaultModel: 'm' }, fakeHome);
    const second = writeCustomProvider({ id: 'x', name: 'X (renamed)', baseUrl: 'https://x/', defaultModel: 'm2' }, fakeHome);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt >= first.updatedAt).toBe(true);
  });
});

describe('deleteCustomProvider', () => {
  it('returns true on existing, false on missing', () => {
    writeCustomProvider({ id: 'tmp', name: 'Tmp', baseUrl: 'https://x/', defaultModel: 'm' }, fakeHome);
    expect(deleteCustomProvider('tmp', fakeHome)).toBe(true);
    expect(deleteCustomProvider('tmp', fakeHome)).toBe(false);
  });
});

describe('path-traversal guard', () => {
  it('refuses ids with slash / dotdot / weird chars', () => {
    expect(() => readCustomProvider('../etc/passwd', fakeHome)).toThrow(/invalid/);
    expect(() => deleteCustomProvider('foo/bar', fakeHome)).toThrow(/invalid/);
  });
});
