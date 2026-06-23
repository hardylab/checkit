// app/lib/api.ts — fetch wrappers for the Next.js API routes.
// Same shape as window.checkit.scan in Electron, so renderer code is
// portable between dev (browser-only) and prod (Electron desktop).

import type { Issue } from './report';

export type RuleDoc = {
  id: string;
  title: string;
  tags: string[];
  severity: 'error' | 'warning' | 'info';
  status: 'stable' | 'draft' | 'experimental';
  since: string;
  category: string;
  categoryPath: string;
  relativePath: string;
  tldr: string;
  body: string;
};

export async function fetchRules(): Promise<{ rules: RuleDoc[]; count: number }> {
  const r = await fetch('/api/rules', { cache: 'no-store' });
  if (!r.ok) throw new Error(`fetchRules failed: ${r.status}`);
  return r.json();
}

export async function fetchRuleBody(id: string): Promise<string> {
  const r = await fetch(`/api/rules/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`fetchRuleBody failed: ${r.status}`);
  return r.text();
}

export type ScanResult = {
  ok: boolean;
  exitCode?: number;
  issues?: Issue[];
  stderr?: string;
  raw?: string;
  parseError?: string;
  error?: string;
};

/** Scan a directory via the Next.js API route (used in browser/Electron). */
export async function apiScan(opts: { cwd: string; fix?: boolean; aiFix?: boolean }): Promise<ScanResult> {
  const r = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  return r.json();
}

/** Prefer window.checkit (Electron native) if available, else fall back to API. */
export async function scanProject(opts: { cwd: string; fix?: boolean; aiFix?: boolean }): Promise<ScanResult> {
  if (typeof window !== 'undefined' && window.checkit?.scan) {
    return window.checkit.scan(opts);
  }
  return apiScan(opts);
}

/** Pick folder — prefer Electron native dialog, else ask user to type a path. */
export async function pickFolder(): Promise<string | null> {
  if (typeof window !== 'undefined' && window.checkit?.pickFolder) {
    return window.checkit.pickFolder();
  }
  // Browser fallback: prompt for absolute path
  const path = window.prompt('输入项目根目录的绝对路径:');
  return path && path.trim() ? path.trim() : null;
}