// app/api/rule-sets/route.ts — bundled rule sets catalog.
// Each set references rule IDs in the on-disk catalog. We return both
// the static set definition and the resolved rules (with metadata) so
// the marketplace UI doesn't need a second fetch.

import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';

type RuleMini = {
  id: string;
  title: string;
  severity: string;
  tldr: string;
};

export async function GET() {
  const { RULE_SETS } = await import('../../lib/rule-sets');
  const root = findRulesRoot();
  const allRules = await loadRuleMinis(root);

  // Resolve each set's ruleIds against the catalog; mark missing ones.
  const byId = new Map(allRules.map((r) => [r.id, r]));
  const sets = RULE_SETS.map((set) => {
    const resolved = set.ruleIds
      .map((id) => byId.get(id))
      .filter((r): r is RuleMini => !!r);
    const missing = set.ruleIds.filter((id) => !byId.has(id));
    return { ...set, resolved, missing };
  });

  return NextResponse.json({ count: sets.length, sets });
}

function findRulesRoot(): string {
  const candidates = [
    path.resolve(process.cwd(), '..', '..', 'packages', 'backend', 'src', 'rules'),
    path.resolve(process.cwd(), '..', '..', '..', 'packages', 'backend', 'src', 'rules'),
    path.resolve(process.cwd(), 'packages', 'backend', 'src', 'rules'),
  ];
  for (const p of candidates) {
    try { if (require('node:fs').existsSync(p)) return p; } catch {}
  }
  throw new Error('Could not locate packages/backend/src/rules');
}

async function loadRuleMinis(root: string): Promise<RuleMini[]> {
  const out: RuleMini[] = [];
  async function walk(dir: string, catPath: string[]) {
    let entries: Awaited<ReturnType<typeof fs.readdir>>;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full, [...catPath, entry.name]);
      else if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('README')) {
        const stem = entry.name.replace(/\.md$/, '');
        if (catPath.length !== 2 || catPath[1] !== stem) continue;
        try {
          const md = await fs.readFile(full, 'utf-8');
          const m = md.match(/^---\n([\s\S]*?)\n---/);
          if (!m) continue;
          const meta: Record<string, string> = {};
          for (const line of m[1].split('\n')) {
            const kv = line.match(/^([\w-]+):\s*(.*)$/);
            if (kv) meta[kv[1]] = kv[2].trim().replace(/^['"]|['"]$/g, '');
          }
          out.push({
            id: catPath[1],
            title: meta.title ?? catPath[1],
            severity: meta.severity === 'warn' ? 'warning' : (meta.severity ?? 'warning'),
            tldr: extractTldr(md),
          });
        } catch {}
      }
    }
  }
  await walk(root, []);
  return out;
}

function extractTldr(md: string): string {
  const m = md.replace(/^---[\s\S]*?---\n/, '').match(/##\s*TL;DR\s*\n+([\s\S]*?)(?:\n##|\n*$)/);
  if (!m) return '';
  return m[1].replace(/`([^`]+)`/g, '$1').replace(/\n+/g, ' ').trim().slice(0, 200);
}