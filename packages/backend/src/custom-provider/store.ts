// packages/backend/src/custom-provider/store.ts — Custom provider filesystem CRUD.
//
// Custom providers live as JSON files in ~/.checkit/custom-providers/<id>.json.
// This is separate from `~/.checkit/config.json` so users can manage
// them like the built-in list (each is a discoverable, editable unit).
//
// Per-file shape:
//   {
//     "id": "deepseek",
//     "name": "DeepSeek",
//     "baseUrl": "https://api.deepseek.com/",
//     "defaultModel": "deepseek-v4-pro",
//     "icon": "DS",           // optional, future
//     "createdAt": "2026-06-25T...",
//     "updatedAt": "2026-06-25T..."
//   }
//
// API keys are NOT stored here — they live in the user's main
// config.json under ai.api_key (and the active provider is set by
// ai.adapter = <custom id>). This keeps secrets in one place.

import fs from 'node:fs';
import path from 'node:path';

export interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  createdAt: string;
  updatedAt: string;
}

const SUBDIR = 'custom-providers';

function dirPath(home: string = homeDir()): string {
  return path.join(home, '.checkit', SUBDIR);
}

function homeDir(): string {
  // Honor $HOME for tests + portability; on Windows Node's homedir() is
  // %USERPROFILE%, so process.env.HOME is the next best test override.
  if (process.env.HOME) return process.env.HOME;
  if (process.env.USERPROFILE) return process.env.USERPROFILE;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('node:os').homedir();
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Normalize a user-typed name into a stable id (lowercase, hyphens). */
export function slugify(name: string): string {
  return name.trim().toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function filePath(id: string, home?: string): string {
  // Defense in depth: even if a caller hands us "../etc", refuse.
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(id)) {
    throw new Error(`invalid custom provider id: "${id}"`);
  }
  return path.join(dirPath(home), `${id}.json`);
}

export function ensureDir(home?: string): void {
  fs.mkdirSync(dirPath(home), { recursive: true });
}

export function listCustomProviders(home?: string): CustomProvider[] {
  const d = dirPath(home);
  if (!fs.existsSync(d)) return [];
  const out: CustomProvider[] = [];
  for (const name of fs.readdirSync(d)) {
    if (!name.endsWith('.json')) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(d, name), 'utf-8'));
      out.push(raw as CustomProvider);
    } catch {
      // skip corrupt files
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function readCustomProvider(id: string, home?: string): CustomProvider | null {
  const fp = filePath(id, home);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, 'utf-8')) as CustomProvider;
}

export function writeCustomProvider(
  p: Omit<CustomProvider, 'createdAt' | 'updatedAt'>,
  home?: string,
): CustomProvider {
  if (!p.id || !p.name) throw new Error('id and name are required');
  ensureDir(home);
  const existing = readCustomProvider(p.id, home);
  const now = nowIso();
  const record: CustomProvider = {
    ...p,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  fs.writeFileSync(filePath(p.id, home), JSON.stringify(record, null, 2), 'utf-8');
  return record;
}

export function deleteCustomProvider(id: string, home?: string): boolean {
  const fp = filePath(id, home);
  if (!fs.existsSync(fp)) return false;
  fs.unlinkSync(fp);
  return true;
}
