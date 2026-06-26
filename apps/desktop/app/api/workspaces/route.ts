// app/api/workspaces/route.ts — list / create workspaces.
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
    try { require('node:fs').accessSync(p); return p; }
    catch { /* try next */ }
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

export async function GET() {
  try {
    const { stdout, code, stderr } = await runCli(['workspace', 'list']);
    if (code !== 0) {
      return NextResponse.json({ error: stderr || 'list failed' }, { status: 500 });
    }
    const parsed = JSON.parse(stdout) as { workspaces: Array<Record<string, unknown>> };
    return NextResponse.json({ workspaces: parsed.workspaces ?? [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: { id?: string; name?: string; description?: string; roots?: string[]; presetIds?: string[] } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  if (!Array.isArray(body.roots) || body.roots.length === 0) {
    return NextResponse.json({ error: 'at least one root is required' }, { status: 400 });
  }
  const args = [
    'workspace', 'add', body.id,
    '--name', body.name ?? body.id,
  ];
  if (body.description) args.push('--description', body.description);
  for (const r of body.roots) args.push('--root', r);
  for (const p of (body.presetIds ?? [])) args.push('--preset', p);
  try {
    const { stdout, code, stderr } = await runCli(args);
    if (code !== 0) {
      return NextResponse.json({ error: stderr || stdout || 'add failed' }, { status: 500 });
    }
    const parsed = JSON.parse(stdout) as { ok: boolean; workspace: unknown };
    return NextResponse.json({ ok: parsed.ok, workspace: parsed.workspace });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
