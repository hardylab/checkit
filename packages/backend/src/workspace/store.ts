// packages/backend/src/workspace/store.ts — workspace filesystem CRUD.

import fs from 'node:fs';
import path from 'node:path';
import { Workspace } from './schema.js';

const SUBDIR = 'workspaces';

function homeDir(): string {
  if (process.env.HOME) return process.env.HOME;
  if (process.env.USERPROFILE) return process.env.USERPROFILE;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('node:os').homedir();
}

function dirPath(home: string = homeDir()): string {
  return path.join(home, '.checkit', SUBDIR);
}

function nowIso(): string {
  return new Date().toISOString();
}

export function slugify(name: string): string {
  return name.trim().toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function filePath(id: string, home?: string): string {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(id)) {
    throw new Error(`invalid workspace id: "${id}"`);
  }
  return path.join(dirPath(home), `${id}.json`);
}

export function ensureDir(home?: string): void {
  fs.mkdirSync(dirPath(home), { recursive: true });
}

export function listWorkspaces(home?: string): Workspace[] {
  const d = dirPath(home);
  if (!fs.existsSync(d)) return [];
  const out: Workspace[] = [];
  for (const name of fs.readdirSync(d)) {
    if (!name.endsWith('.json')) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(d, name), 'utf-8'));
      out.push(raw as Workspace);
    } catch { /* skip corrupt */ }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function readWorkspace(id: string, home?: string): Workspace | null {
  const fp = filePath(id, home);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, 'utf-8')) as Workspace;
}

export function writeWorkspace(
  w: Omit<Workspace, 'createdAt' | 'updatedAt'>,
  home?: string,
): Workspace {
  if (!w.id) throw new Error('id is required');
  if (!w.name) throw new Error('name is required');
  if (!Array.isArray(w.roots)) throw new Error('roots must be an array');
  if (!Array.isArray(w.presetIds)) throw new Error('presetIds must be an array');
  ensureDir(home);
  const existing = readWorkspace(w.id, home);
  const now = nowIso();
  const record: Workspace = {
    ...w,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  fs.writeFileSync(filePath(w.id, home), JSON.stringify(record, null, 2), 'utf-8');
  return record;
}

export function deleteWorkspace(id: string, home?: string): boolean {
  const fp = filePath(id, home);
  if (!fs.existsSync(fp)) return false;
  fs.unlinkSync(fp);
  return true;
}

/** Mark a workspace as scanned (touch lastScannedAt). */
export function touchWorkspaceScanned(id: string, home?: string): Workspace | null {
  const w = readWorkspace(id, home);
  if (!w) return null;
  w.lastScannedAt = nowIso();
  w.updatedAt = w.lastScannedAt;
  fs.writeFileSync(filePath(id, home), JSON.stringify(w, null, 2), 'utf-8');
  return w;
}
