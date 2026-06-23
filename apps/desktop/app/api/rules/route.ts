// app/api/rules/route.ts — list all built-in checkit rules.
// Reads *.md files under packages/backend/src/rules/**/*.md and parses
// the OKF v0.1 frontmatter so the Web UI can show the rule catalog.

import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';

type Severity = 'error' | 'warning' | 'info';
type Status = 'stable' | 'draft' | 'experimental';

type RuleDoc = {
  id: string;
  title: string;
  tags: string[];
  severity: Severity;
  status: Status;
  since: string;
  category: string;
  categoryPath: string;
  relativePath: string;
  mdPath: string;
  tldr: string;
  body: string;
};

function normalizeSeverity(s: string): Severity {
  if (s === 'warn') return 'warning';
  if (s === 'error' || s === 'warning' || s === 'info') return s;
  return 'warning';
}

/** Locate packages/backend/src/rules from apps/desktop. Walks up the tree. */
function findRulesRoot(): string {
  const candidates = [
    path.resolve(process.cwd(), '..', '..', 'packages', 'backend', 'src', 'rules'),
    path.resolve(process.cwd(), '..', '..', '..', 'packages', 'backend', 'src', 'rules'),
    path.resolve(process.cwd(), 'packages', 'backend', 'src', 'rules'),
  ];
  for (const p of candidates) {
    try {
      if (require('node:fs').existsSync(p)) return p;
    } catch {}
  }
  throw new Error('Could not locate packages/backend/src/rules from apps/desktop');
}

function parseFrontmatter(md: string): { meta: Record<string, string>; body: string } {
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: md };
  const meta: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('[') && v.endsWith(']')) {
      v = v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean).join(',');
    }
    meta[kv[1]] = v.replace(/^['"]|['"]$/g, '');
  }
  return { meta, body: m[2] };
}

function extractTldr(body: string): string {
  const m = body.match(/##\s*TL;DR\s*\n+([\s\S]*?)(?:\n##|\n*$)/);
  if (!m) return '';
  return m[1]
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 280);
}

async function readAllRules(): Promise<RuleDoc[]> {
  const root = findRulesRoot();
  const out: RuleDoc[] = [];

  // Folder structure: src/rules/<category>/<rule-id>/<rule-id>.md
  // We walk recursively but only collect when catPath.length === 2 and
  // catPath[1] (rule-id) matches the file stem.
  async function walk(dir: string, catPath: string[]): Promise<void> {
    let entries: Awaited<ReturnType<typeof fs.readdir>>;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, [...catPath, entry.name]);
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.md') &&
        !entry.name.startsWith('README')
      ) {
        const stem = entry.name.replace(/\.md$/, '');
        // catPath === [<category>, <rule-id>], stem === rule-id
        if (catPath.length !== 2 || catPath[1] !== stem) continue;
        const md = await fs.readFile(full, 'utf-8');
        const { meta, body } = parseFrontmatter(md);
        if (!meta.name) continue;
        // The directory name is the canonical rule id — some early rules
        // have a malformed `name:` in their frontmatter (with extra path
        // components like `file\\doc-pattern\\doc-pattern`). Trust the
        // folder layout over the frontmatter.
        const canonicalId = catPath[1];
        out.push({
          id: canonicalId,
          title: meta.title ?? canonicalId,
          tags: (meta.tags ?? '').split(',').map((s) => s.trim()).filter(Boolean),
          severity: normalizeSeverity(meta.severity ?? 'warning'),
          status: (meta.status === 'draft' || meta.status === 'experimental') ? meta.status : 'stable',
          since: meta.since ?? '',
          category: catPath[0] ?? 'other',
          categoryPath: catPath.join('/'),
          relativePath: `packages/backend/src/rules/${catPath.join('/')}/${entry.name}`,
          mdPath: full,
          tldr: extractTldr(body),
          body,
        });
      }
    }
  }

  await walk(root, []);
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export async function GET() {
  try {
    const rules = await readAllRules();
    return NextResponse.json({ rules, count: rules.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, rules: [], count: 0 }, { status: 500 });
  }
}