// app/api/presets/route.ts — list and create presets.
import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

function findCliBinary(): string {
  const candidates = [
    path.resolve(process.cwd(), '..', '..', 'packages', 'backend', 'dist', 'cli.cjs'),
    path.resolve(process.cwd(), '..', '..', '..', 'packages', 'backend', 'dist', 'cli.cjs'),
    path.resolve(process.cwd(), 'packages', 'backend', 'dist', 'cli.cjs'),
  ];
  for (const p of candidates) {
    try {
      // eslint-disable-next-line no-sync
      require('node:fs').accessSync(p);
      return p;
    } catch { /* try next */ }
  }
  throw new Error('Could not locate packages/backend/dist/cli.cjs');
}

function runCli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const bin = findCliBinary();
    const child = spawn(process.execPath, [bin, ...args, '--json'], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', LINTANY_FORCE_UTF8_STDOUT: '1' },
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c.toString('utf-8'); });
    child.stderr.on('data', (c) => { stderr += c.toString('utf-8'); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ stdout, stderr, code }));
  });
}

export async function POST(req: Request) {
  let body: { id?: string; name?: string; description?: string; rules?: string[]; scope?: 'project' | 'global' } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const args: string[] = ['preset', 'new', body.id];
  if (body.scope) args.push('--scope', body.scope);
  if (body.name) args.push('--name', body.name);
  if (body.description) args.push('--description', body.description);
  if (Array.isArray(body.rules) && body.rules.length > 0) {
    args.push('--rules', body.rules.join(','));
  }
  let r: { stdout: string; stderr: string; code: number };
  try {
    r = await runCli(args);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  if (r.code !== 0) {
    return NextResponse.json({ error: r.stderr || r.stdout || 'create failed' }, { status: 500 });
  }
  return NextResponse.json(JSON.parse(r.stdout));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cwd = searchParams.get('cwd') || undefined;
  // Always list BOTH project (cwd-scoped) and global (~/.checkit/presets)
  // — desktop UI needs both views in the Preset tab. We call the CLI
  // twice with explicit --scope flags to make each list complete.
  const results: Array<Record<string, unknown> & { scope: 'project' | 'global' }> = [];
  if (cwd) {
    const r1 = await runCli(['preset', 'list', '--scope', 'project', '--cwd', cwd, '--json']).catch((e) => ({ code: 1, stdout: '', stderr: (e as Error).message }));
    if (r1.code !== 0) {
      return NextResponse.json({ error: r1.stderr || 'project list failed' }, { status: 500 });
    }
    const parsed = JSON.parse(r1.stdout) as { project: Array<Record<string, unknown>>; global: Array<Record<string, unknown>> };
    for (const p of parsed.project ?? []) results.push({ ...p, scope: 'project' });
    for (const p of parsed.global  ?? []) results.push({ ...p, scope: 'global'  });
  } else {
    const r2 = await runCli(['preset', 'list', '--scope', 'global', '--json']).catch((e) => ({ code: 1, stdout: '', stderr: (e as Error).message }));
    if (r2.code !== 0) {
      return NextResponse.json({ error: r2.stderr || 'global list failed' }, { status: 500 });
    }
    const parsed = JSON.parse(r2.stdout) as { global: Array<Record<string, unknown>> };
    for (const p of parsed.global ?? []) results.push({ ...p, scope: 'global' });
  }
  return NextResponse.json({ presets: results });
}
