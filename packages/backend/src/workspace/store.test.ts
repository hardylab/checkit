// packages/backend/src/workspace/store.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  listWorkspaces,
  readWorkspace,
  writeWorkspace,
  deleteWorkspace,
  touchWorkspaceScanned,
  slugify,
} from './store.js';

let fakeHome: string;
beforeEach(() => {
  fakeHome = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'lintany-ws-'));
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
    expect(slugify('My App')).toBe('my-app');
    expect(slugify('MyApp 2')).toBe('myapp-2');
  });
});

describe('writeWorkspace / readWorkspace / list', () => {
  it('writes and reads a workspace', () => {
    const w = writeWorkspace({
      id: 'my-app', name: 'My App', roots: ['/tmp/x', '/tmp/y'], presetIds: ['a', 'b'],
    }, fakeHome);
    expect(w.id).toBe('my-app');
    expect(w.createdAt).toBeDefined();
    expect(readWorkspace('my-app', fakeHome)).toEqual(w);
  });
  it('lists sorted by name', () => {
    writeWorkspace({ id: 'b', name: 'Bravo', roots: ['/x'], presetIds: [] }, fakeHome);
    writeWorkspace({ id: 'a', name: 'Alpha', roots: ['/y'], presetIds: [] }, fakeHome);
    expect(listWorkspaces(fakeHome).map((w) => w.id)).toEqual(['a', 'b']);
  });
});

describe('deleteWorkspace', () => {
  it('returns true on existing, false on missing', () => {
    writeWorkspace({ id: 'tmp', name: 'T', roots: [], presetIds: [] }, fakeHome);
    expect(deleteWorkspace('tmp', fakeHome)).toBe(true);
    expect(deleteWorkspace('tmp', fakeHome)).toBe(false);
  });
});

describe('touchWorkspaceScanned', () => {
  it('updates lastScannedAt', () => {
    const w = writeWorkspace({ id: 'x', name: 'X', roots: ['/x'], presetIds: [] }, fakeHome);
    expect(w.lastScannedAt).toBeUndefined();
    const w2 = touchWorkspaceScanned('x', fakeHome);
    expect(w2?.lastScannedAt).toBeDefined();
  });
});

describe('path-traversal guard', () => {
  it('refuses bad ids', () => {
    expect(() => readWorkspace('../etc/passwd', fakeHome)).toThrow(/invalid/);
    expect(() => deleteWorkspace('foo/bar', fakeHome)).toThrow(/invalid/);
  });
});
