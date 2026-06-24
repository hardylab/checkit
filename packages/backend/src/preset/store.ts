// packages/backend/src/preset/store.ts — filesystem CRUD for presets
//
// 存储约定(per MSP 第 0 节):
// - per-project: <cwd>/.checkit/presets/<id>.preset.json
// - global:      ~/.checkit/presets/<id>.preset.json
// - 索引文件:    同目录下 presets.json(列出所有 preset)
//
// 命名空间("scope"):
// - "project" = 当前 cwd(可省略)
// - "global"  = 用户主目录下(~/.checkit/presets/)
//
// 设计原则:
// - atomic write:write .tmp 再 rename,避免半截文件
// - read 失败时 throw(让上层报错,不要 silently fallback)
// - index 是 best-effort cache:启动时如果不存在或坏掉,rebuild from files

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  validatePreset,
  normalizePreset,
  type Preset,
  type PresetIndex,
  type PresetIndexEntry,
  type PresetSource,
} from './schema.js';

export type PresetScope = 'project' | 'global';

/** Resolve the preset directory for a given scope. */
export function presetDir(scope: PresetScope, cwd: string = process.cwd()): string {
  if (scope === 'global') {
    // Honor $HOME for tests + POSIX shells; fall back to OS-native home.
    // On Windows, USERPROFILE is the canonical home; on POSIX, HOME is.
    const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
    return path.join(home, '.checkit', 'presets');
  }
  return path.join(cwd, '.checkit', 'presets');
}

/** Get the index file path. */
function indexPath(dir: string): string {
  return path.join(dir, 'presets.json');
}

/** File path for a single preset. */
function presetFilePath(dir: string, id: string): string {
  // sanitize id: only [a-z0-9-_] allowed; everything else becomes -
  const safe = id.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  return path.join(dir, `${safe}.preset.json`);
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function readIndex(dir: string): PresetIndex {
  const ip = indexPath(dir);
  if (!fs.existsSync(ip)) return { version: 1, presets: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(ip, 'utf-8'));
    if (typeof raw !== 'object' || raw === null) return { version: 1, presets: [] };
    const idx = raw as PresetIndex;
    if (!Array.isArray(idx.presets)) return { version: 1, presets: [] };
    return { version: 1, presets: idx.presets };
  } catch {
    return { version: 1, presets: [] };
  }
}

function writeIndex(dir: string, idx: PresetIndex): void {
  ensureDir(dir);
  const ip = indexPath(dir);
  const tmp = `${ip}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(idx, null, 2));
  fs.renameSync(tmp, ip);
}

function rebuildIndex(dir: string): PresetIndex {
  if (!fs.existsSync(dir)) return { version: 1, presets: [] };
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.preset.json'));
  const entries: PresetIndexEntry[] = [];
  for (const f of files) {
    const fp = path.join(dir, f);
    try {
      const raw = JSON.parse(fs.readFileSync(fp, 'utf-8'));
      const p = normalizePreset(validatePreset(raw, fp));
      entries.push({
        id: p.id,
        name: p.name,
        source: p.source ?? 'manual',
        rule_count: p.rules.length,
        file: f,
        updated_at: p.metadata?.updated_at,
      });
    } catch {
      // skip broken files silently during rebuild — caller can detect via get()
    }
  }
  entries.sort((a, b) => a.id.localeCompare(b.id));
  return { version: 1, presets: entries };
}

function syncIndexFromFiles(dir: string): PresetIndex {
  const fresh = rebuildIndex(dir);
  writeIndex(dir, fresh);
  return fresh;
}

/**
 * List all presets in a scope (project first, global second if both given).
 * Triggers an index rebuild if the index file is missing or stale.
 */
export function listPresets(scope: PresetScope, cwd?: string): PresetIndexEntry[] {
  const dir = presetDir(scope, cwd);
  if (!fs.existsSync(dir)) return [];
  const idx = readIndex(dir);
  // If index empty but files exist, rebuild
  if (idx.presets.length === 0) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.preset.json'));
    if (files.length > 0) return syncIndexFromFiles(dir).presets;
  }
  return idx.presets;
}

/** Read a single preset by id (project scope first, then global). */
export function readPreset(id: string, scope: PresetScope, cwd?: string): Preset {
  const dir = presetDir(scope, cwd);
  const fp = presetFilePath(dir, id);
  if (!fs.existsSync(fp)) {
    throw new Error(`Preset "${id}" not found in ${scope} (${dir})`);
  }
  const raw = JSON.parse(fs.readFileSync(fp, 'utf-8'));
  return normalizePreset(validatePreset(raw, fp));
}

/** Check whether a preset id exists in a scope. */
export function hasPreset(id: string, scope: PresetScope, cwd?: string): boolean {
  const dir = presetDir(scope, cwd);
  return fs.existsSync(presetFilePath(dir, id));
}

/**
 * Write (create or overwrite) a preset.
 * Refuses to overwrite a `bundled` preset — caller must use `updatePreset` or
 * `importPreset` explicitly.
 */
export function writePreset(
  p: Preset,
  opts: { scope?: PresetScope; cwd?: string; allowBundledOverwrite?: boolean; allowOverwrite?: boolean } = {},
): { path: string; index: PresetIndex } {
  // Validate the preset shape NOW (before touching disk) so bad thresholds etc.
  // surface as write errors, not read errors later.
  validatePreset(p);

  const scope = opts.scope ?? 'project';
  const dir = presetDir(scope, opts.cwd);
  ensureDir(dir);
  const fp = presetFilePath(dir, p.id);

  if (fs.existsSync(fp)) {
    // Bundled-preserve check first — even if overwrite is otherwise allowed,
    // bundled presets need an extra --force flag.
    const existing = normalizePreset(validatePreset(JSON.parse(fs.readFileSync(fp, 'utf-8'))));
    if (existing.source === 'bundled' && !opts.allowBundledOverwrite) {
      throw new Error(
        `Refusing to overwrite bundled preset "${p.id}". Copy it first with a new id, or use --force.`,
      );
    }
    if (!opts.allowOverwrite) {
      throw new Error(
        `Preset "${p.id}" already exists in ${scope}. Use --force to overwrite, or pick a different id.`,
      );
    }
  }

  const normalized: Preset = {
    ...p,
    source: p.source ?? 'manual',
    metadata: {
      ...(p.metadata ?? {}),
      updated_at: new Date().toISOString(),
    },
  };
  if (!normalized.metadata.created_at) {
    normalized.metadata.created_at = normalized.metadata.updated_at;
  }

  const tmp = `${fp}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(normalized, null, 2));
  fs.renameSync(tmp, fp);

  const idx = syncIndexFromFiles(dir);
  return { path: fp, index: idx };
}

/** Delete a preset. Refuses to delete bundled. */
export function deletePreset(
  id: string,
  scope: PresetScope,
  cwd?: string,
): PresetIndex {
  const dir = presetDir(scope, cwd);
  const fp = presetFilePath(dir, id);
  if (!fs.existsSync(fp)) {
    throw new Error(`Preset "${id}" not found in ${scope} (${dir})`);
  }
  const existing = normalizePreset(validatePreset(JSON.parse(fs.readFileSync(fp, 'utf-8'))));
  if (existing.source === 'bundled') {
    throw new Error(`Refusing to delete bundled preset "${id}".`);
  }
  fs.unlinkSync(fp);
  return syncIndexFromFiles(dir);
}

/**
 * Apply a preset to a project's `.checkit/state.json` by writing the
 * `current_preset` field. Does NOT execute the preset — that's the
 * `scan --preset <id>` concern (out of scope for store).
 */
export function applyPreset(
  id: string,
  cwd: string = process.cwd(),
): { preset: Preset; applied_at: string } {
  // Search project first, then global
  let preset: Preset | null = null;
  try { preset = readPreset(id, 'project', cwd); } catch { /* try global */ }
  if (!preset) {
    try { preset = readPreset(id, 'global', cwd); } catch {
      throw new Error(`Preset "${id}" not found in project (.checkit/presets) or global (~/.checkit/presets).`);
    }
  }

  const stateFile = path.join(cwd, '.checkit', 'state.json');
  let state: Record<string, unknown> = {};
  if (fs.existsSync(stateFile)) {
    try { state = JSON.parse(fs.readFileSync(stateFile, 'utf-8')); } catch {
      throw new Error(`Existing .checkit/state.json is not valid JSON: ${stateFile}`);
    }
  }
  state.current_preset = preset.id;
  state.applied_at = new Date().toISOString();
  ensureDir(path.dirname(stateFile));
  const tmp = `${stateFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, stateFile);

  return { preset, applied_at: state.applied_at as string };
}

/**
 * Export a preset to a file (JSON dump, pretty-printed).
 * Returns the destination path.
 */
export function exportPreset(
  id: string,
  output: string,
  cwd?: string,
): { from: PresetSource; to: string } {
  let preset: Preset | null = null;
  let fromScope: PresetSource = 'manual';
  try { preset = readPreset(id, 'project', cwd); fromScope = preset.source ?? 'manual'; } catch { /* try global */ }
  if (!preset) {
    try { preset = readPreset(id, 'global', cwd); fromScope = preset.source ?? 'manual'; } catch {
      throw new Error(`Preset "${id}" not found.`);
    }
  }
  // Export source becomes "imported" — receiving end should re-save with new source if manual edit
  const exported: Preset = { ...preset, source: 'imported' };
  const outAbs = path.resolve(output);
  ensureDir(path.dirname(outAbs));
  const tmp = `${outAbs}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(exported, null, 2));
  fs.renameSync(tmp, outAbs);
  return { from: fromScope, to: outAbs };
}

/**
 * Import a preset from a JSON file. Returns the imported preset and where it landed.
 * ID collisions with existing non-bundled presets are allowed (overwrites).
 */
export function importPreset(
  file: string,
  opts: { scope?: PresetScope; cwd?: string } = {},
): { preset: Preset; path: string; scope: PresetScope } {
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const p = normalizePreset(validatePreset(raw, file));
  // When importing, mark source as "manual" (the user now owns it)
  p.source = 'manual';
  const scope = opts.scope ?? 'project';
  const { path: fp } = writePreset(p, { scope, cwd: opts.cwd, allowBundledOverwrite: false, allowOverwrite: true });
  return { preset: p, path: fp, scope };
}

/** Where presets live for a given scope — exposed for `--help` and `doctor`. */
export function presetDirHint(scope: PresetScope, cwd?: string): string {
  return presetDir(scope, cwd);
}
