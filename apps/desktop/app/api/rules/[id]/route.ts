// app/api/rules/[id]/route.ts — single rule detail (full body).

import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs/promises';

export const dynamic = 'force-dynamic';

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

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const { id } = ctx.params;
  if (!/^[\w-]+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const root = findRulesRoot();
  // Find the rule by walking top-level categories.
  const cats = await fs.readdir(root, { withFileTypes: true });
  for (const cat of cats) {
    if (!cat.isDirectory() || cat.name.startsWith('.') || cat.name === 'node_modules') continue;
    const candidate = path.join(root, cat.name, id, `${id}.md`);
    try {
      const md = await fs.readFile(candidate, 'utf-8');
      return new NextResponse(md, {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
      });
    } catch {
      // not in this category, keep looking
    }
  }
  return NextResponse.json({ error: `Rule not found: ${id}` }, { status: 404 });
}