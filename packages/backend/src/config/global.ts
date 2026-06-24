// packages/backend/src/config/global.ts — global config file at ~/.checkit/config.json
//
// 用途:跨项目偏好(MSP C4 全局数据层)。
// 例:`lintany config set ai.adapter openai` → ~/.checkit/config.json = { ai: { adapter: 'openai' } }
//
// 约定:
// - dot-path keys 用 "." 分隔(ai.adapter / theme / locale)
// - 嵌套 update:不存在的中间层自动创建
// - 删除:删除最深一层 key;中间层为空对象时一并删
// - 文件不存在时,set 自动创建
// - 写入失败 throw(不 silently fallback)

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export type ConfigValue = string | number | boolean | null | ConfigObject | ConfigValue[];
export interface ConfigObject { [k: string]: ConfigValue }

function homeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

export function configFilePath(): string {
  return path.join(homeDir(), '.checkit', 'config.json');
}

function ensureParent(fp: string): void {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
}

function readConfig(fp: string): ConfigObject {
  if (!fs.existsSync(fp)) return {};
  try {
    const raw = fs.readFileSync(fp, 'utf-8');
    if (raw.trim() === '') return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return parsed as ConfigObject;
  } catch (e) {
    throw new Error(`Existing config file is not valid JSON: ${fp}\n  ${(e as Error).message}`);
  }
}

function writeConfig(fp: string, cfg: ConfigObject): void {
  ensureParent(fp);
  const tmp = `${fp}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
  fs.renameSync(tmp, fp);
}

/** Parse "ai.adapter" → ["ai", "adapter"]. Throws on empty or invalid path. */
export function parseKey(key: string): string[] {
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('config key must be a non-empty dot-path like "ai.adapter"');
  }
  if (key.startsWith('.') || key.endsWith('.') || key.includes('..')) {
    throw new Error(`config key "${key}" has invalid dot-path (leading/trailing/double dot)`);
  }
  const parts = key.split('.');
  if (parts.some((p) => p.length === 0)) {
    throw new Error(`config key "${key}" has an empty segment`);
  }
  return parts;
}

/**
 * Parse a string CLI value into a typed ConfigValue.
 * - "true"/"false" → boolean
 * - numeric → number
 * - "null" → null
 * - JSON object/array if starts with { or [
 * - else raw string
 */
export function parseValue(raw: string): ConfigValue {
  if (raw === 'null') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
  if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
    try { return JSON.parse(raw); } catch { /* fall through to string */ }
  }
  return raw;
}

/**
 * Set a dot-path key to a parsed value. Returns the new full config.
 * Throws on type conflict (e.g. trying to set "ai" to a string when it's already an object).
 */
export function setConfig(key: string, value: ConfigValue): ConfigObject {
  const fp = configFilePath();
  const cfg = readConfig(fp);
  const parts = parseKey(key);

  let cursor: ConfigObject = cfg;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    const existing = cursor[p];
    if (existing === undefined) {
      cursor[p] = {};
    } else if (typeof existing !== 'object' || existing === null || Array.isArray(existing)) {
      throw new Error(
        `Cannot set "${key}": "${parts.slice(0, i + 1).join('.')}" exists and is not an object (got ${Array.isArray(existing) ? 'array' : typeof existing}).`,
      );
    }
    cursor = cursor[p] as ConfigObject;
  }
  cursor[parts[parts.length - 1]] = value;
  writeConfig(fp, cfg);
  return cfg;
}

/** Get a value by dot-path. Returns undefined if any segment is missing. */
export function getConfig(key: string): { value: ConfigValue | undefined; found: boolean } {
  const fp = configFilePath();
  if (!fs.existsSync(fp)) return { value: undefined, found: false };
  const cfg = readConfig(fp);
  const parts = parseKey(key);
  let cursor: ConfigValue | undefined = cfg;
  // First, traverse and check existence — if any segment is missing, NOT FOUND.
  for (const p of parts) {
    if (typeof cursor !== 'object' || cursor === null || Array.isArray(cursor)) {
      return { value: undefined, found: false };
    }
    if (!(p in (cursor as ConfigObject))) {
      return { value: undefined, found: false };
    }
    cursor = (cursor as ConfigObject)[p];
  }
  // After traversal, the leaf must exist AND be meaningful.
  // (cursor could be undefined if a segment was explicitly set to undefined;
  // or an empty {} if unsetConfig cleaned up the parent — treat both as not-found.)
  if (cursor === undefined) return { value: undefined, found: false };
  if (typeof cursor === 'object' && cursor !== null && !Array.isArray(cursor) && Object.keys(cursor).length === 0) {
    return { value: undefined, found: false };
  }
  return { value: cursor, found: true };
}

/** List all keys as dot-paths. Sorted. */
export function listConfig(): string[] {
  const fp = configFilePath();
  if (!fs.existsSync(fp)) return [];
  const cfg = readConfig(fp);
  const out: string[] = [];
  const walk = (obj: ConfigObject, prefix: string) => {
    for (const k of Object.keys(obj).sort()) {
      const path = prefix ? `${prefix}.${k}` : k;
      const v = obj[k];
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        walk(v as ConfigObject, path);
      } else {
        out.push(path);
      }
    }
  };
  walk(cfg, '');
  return out;
}

/**
 * Unset a dot-path key. Returns true if removed, false if not present.
 * Cleans up intermediate parents that became empty as a result of this unset.
 * Never deletes from the root object — that's the user's structural choice.
 */
export function unsetConfig(key: string): boolean {
  const fp = configFilePath();
  if (!fs.existsSync(fp)) return false;
  const cfg = readConfig(fp);
  const parts = parseKey(key);

  // Walk to confirm the path exists; remember each (parent, childKey) edge.
  const edges: { parent: ConfigObject; childKey: string }[] = [];
  let cursor: ConfigValue | undefined = cfg;
  for (const p of parts) {
    if (typeof cursor !== 'object' || cursor === null || Array.isArray(cursor)) return false;
    const parent = cursor as ConfigObject;
    if (!(p in parent)) return false;
    edges.push({ parent, childKey: p });
    cursor = parent[p];
  }
  // Delete the leaf.
  const leafEdge = edges.pop()!;
  delete leafEdge.parent[leafEdge.childKey];
  // Walk back up. At each intermediate, drop the intermediate key itself if
  // it now points to an empty object (its only child was just removed).
  while (edges.length > 0) {
    const edge = edges.pop()!;
    // The child we just removed from edge.parent — check if its value is now
    // an empty object (the only scenario where cleanup is correct).
    const childValue = edge.parent[edge.childKey];
    if (
      childValue !== undefined &&
      typeof childValue === 'object' &&
      childValue !== null &&
      !Array.isArray(childValue) &&
      Object.keys(childValue).length === 0
    ) {
      delete edge.parent[edge.childKey];
    } else {
      break;
    }
  }
  writeConfig(fp, cfg);
  return true;
}

/** Pretty-print a value for `get` output (no JSON.stringify for primitives). */
export function formatValue(v: ConfigValue): string {
  if (typeof v === 'string') return v;
  if (v === null) return 'null';
  return JSON.stringify(v);
}
