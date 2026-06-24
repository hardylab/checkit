// packages/backend/src/preset/store.test.ts — preset store unit tests
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  listPresets,
  readPreset,
  writePreset,
  deletePreset,
  applyPreset,
  exportPreset,
  importPreset,
  hasPreset,
} from './store.js';
import type { Preset } from './schema.js';

let tmpDir: string;
let origHome: string | undefined;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preset-test-'));
  origHome = process.env.HOME;
  // Redirect HOME so global preset dir lands inside tmpDir
  const fakeHome = path.join(tmpDir, 'home');
  fs.mkdirSync(fakeHome, { recursive: true });
  process.env.HOME = fakeHome;
});

afterEach(() => {
  if (origHome !== undefined) process.env.HOME = origHome;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const samplePreset = (overrides: Partial<Preset> = {}): Preset => ({
  id: 'test-preset',
  name: 'Test Preset',
  description: 'unit test fixture',
  rules: [
    { id: 'no-any-rule', enabled: true, threshold: 'error' },
    { id: 'no-console-log', enabled: false },
  ],
  ...overrides,
});

describe('preset store — project scope', () => {
  it('writePreset creates file + index', () => {
    const p = samplePreset();
    const { path: fp } = writePreset(p, { scope: 'project', cwd: tmpDir });
    expect(fs.existsSync(fp)).toBe(true);

    const idx = listPresets('project', tmpDir);
    expect(idx).toHaveLength(1);
    expect(idx[0].id).toBe('test-preset');
    expect(idx[0].rule_count).toBe(2);
  });

  it('readPreset returns normalized fields', () => {
    const p = samplePreset({ description: undefined, version: undefined, source: undefined });
    writePreset(p, { scope: 'project', cwd: tmpDir });
    const back = readPreset('test-preset', 'project', tmpDir);
    expect(back.id).toBe('test-preset');
    expect(back.description).toBe('');            // normalized default
    expect(back.version).toBe('1.0');             // normalized default
    expect(back.source).toBe('manual');            // normalized default
    expect(back.rules[0].enabled).toBe(true);      // normalized default
    expect(back.rules[1].threshold).toBe('error'); // normalized default
    expect(back.metadata?.updated_at).toBeTruthy(); // auto-set on write
  });

  it('rejects overwrite of bundled preset', () => {
    const bundled = samplePreset({ source: 'bundled' });
    writePreset(bundled, { scope: 'project', cwd: tmpDir });

    const attempt = samplePreset({ name: 'mutated' });
    expect(() => writePreset(attempt, { scope: 'project', cwd: tmpDir })).toThrow(/bundled/i);
  });

  it('deletePreset removes file + re-indexes', () => {
    writePreset(samplePreset(), { scope: 'project', cwd: tmpDir });
    expect(hasPreset('test-preset', 'project', tmpDir)).toBe(true);
    deletePreset('test-preset', 'project', tmpDir);
    expect(hasPreset('test-preset', 'project', tmpDir)).toBe(false);
    expect(listPresets('project', tmpDir)).toHaveLength(0);
  });

  it('deletePreset refuses bundled', () => {
    writePreset(samplePreset({ source: 'bundled' }), { scope: 'project', cwd: tmpDir });
    expect(() => deletePreset('test-preset', 'project', tmpDir)).toThrow(/bundled/i);
  });

  it('listPresets rebuilds index from files when index missing', () => {
    writePreset(samplePreset(), { scope: 'project', cwd: tmpDir });
    // Manually delete the index file
    const idxPath = path.join(tmpDir, '.checkit', 'presets', 'presets.json');
    fs.unlinkSync(idxPath);

    const list = listPresets('project', tmpDir);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('test-preset');
    // Rebuild wrote the index back
    expect(fs.existsSync(idxPath)).toBe(true);
  });
});

describe('preset store — apply / export / import', () => {
  it('applyPreset writes .checkit/state.json', () => {
    writePreset(samplePreset(), { scope: 'project', cwd: tmpDir });
    const { applied_at, preset } = applyPreset('test-preset', tmpDir);
    expect(preset.id).toBe('test-preset');
    expect(applied_at).toBeTruthy();

    const stateFile = path.join(tmpDir, '.checkit', 'state.json');
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    expect(state.current_preset).toBe('test-preset');
    expect(state.applied_at).toBe(applied_at);
  });

  it('applyPreset falls back to global when not in project', () => {
    writePreset(samplePreset(), { scope: 'global' });
    const { preset } = applyPreset('test-preset', tmpDir);
    expect(preset.id).toBe('test-preset');
  });

  it('applyPreset throws when not found anywhere', () => {
    expect(() => applyPreset('nope', tmpDir)).toThrow(/not found/i);
  });

  it('exportPreset + importPreset round-trip', () => {
    writePreset(samplePreset(), { scope: 'project', cwd: tmpDir });
    const outFile = path.join(tmpDir, 'out.preset.json');
    const { to } = exportPreset('test-preset', outFile, tmpDir);
    expect(to).toBe(outFile);

    // Clean project scope so import is the only source
    deletePreset('test-preset', 'project', tmpDir);
    expect(hasPreset('test-preset', 'project', tmpDir)).toBe(false);

    // Import to a different scope
    const { preset, scope } = importPreset(outFile, { scope: 'project', cwd: tmpDir });
    expect(scope).toBe('project');
    expect(preset.id).toBe('test-preset');
    expect(preset.source).toBe('manual'); // imports are re-marked manual
    expect(hasPreset('test-preset', 'project', tmpDir)).toBe(true);
  });

  it('id collision: import overwrites existing manual preset', () => {
    writePreset(samplePreset({ name: 'v1' }), { scope: 'project', cwd: tmpDir });
    const outFile = path.join(tmpDir, 'out.preset.json');
    exportPreset('test-preset', outFile, tmpDir);
    deletePreset('test-preset', 'project', tmpDir);
    importPreset(outFile, { scope: 'project', cwd: tmpDir });
    expect(readPreset('test-preset', 'project', tmpDir).name).toBe('v1');

    // Direct writePreset with overwrite=true wins over import.
    writePreset(samplePreset({ name: 'v2' }), { scope: 'project', cwd: tmpDir, allowOverwrite: true });
    expect(readPreset('test-preset', 'project', tmpDir).name).toBe('v2');

    // Import (with overwrite) also wins over existing manual preset.
    expect(() => importPreset(outFile, { scope: 'project', cwd: tmpDir })).not.toThrow();
    expect(readPreset('test-preset', 'project', tmpDir).name).toBe('v1');
  });
});

describe('preset store — invalid input', () => {
  it('validatePreset rejects missing id', () => {
    const dir = path.join(tmpDir, '.checkit', 'presets');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'bad.preset.json'), JSON.stringify({ name: 'x', rules: [] }));
    expect(() => listPresets('project', tmpDir)).not.toThrow(); // rebuild skips bad files
  });

  it('writePreset rejects bad threshold', () => {
    const bad = { id: 'x', name: 'X', rules: [{ id: 'r', threshold: 'fatal' }] } as unknown as Preset;
    expect(() => writePreset(bad, { scope: 'project', cwd: tmpDir })).toThrow(/threshold/);
  });
});
