// app/api/workspaces/[id]/route.ts — get / update / delete one workspace.
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

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { stdout, code, stderr } = await runCli(['workspace', 'show', params.id]);
    if (code !== 0) {
      return NextResponse.json({ error: stderr || 'show failed' }, { status: 500 });
    }
    const parsed = JSON.parse(stdout) as { found: boolean; workspace: unknown };
    if (!parsed.found) {
      return NextResponse.json({ error: 'workspace not found' }, { status: 404 });
    }
    return NextResponse.json({ workspace: parsed.workspace });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let body: { name?: string; description?: string; roots?: string[]; presetIds?: string[] } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // PATCH semantics: caller may pass any subset of fields. If `roots` is
  // omitted, we read the existing workspace and pass its roots through so
  // the CLI's `add` upsert doesn't reject with "requires at least one
  // --root". Same for `presetIds`.
  let roots = body.roots;
  let presetIds = body.presetIds;
  if (roots === undefined || presetIds === undefined) {
    try {
      const getResp = await fetch(`${new URL(req.url).origin}/api/workspaces/${encodeURIComponent(params.id)}`);
      if (getResp.ok) {
        const getData = await getResp.json() as { workspace?: { roots?: string[]; presetIds?: string[] } };
        if (roots === undefined)      roots      = getData.workspace?.roots      ?? [];
        if (presetIds === undefined)  presetIds  = getData.workspace?.presetIds  ?? [];
      }
    } catch { /* fall through — CLI will reject if fields missing */ }
  }

  const args = [
    'workspace', 'add', params.id,
    '--name', body.name ?? params.id,
  ];
  if (body.description !== undefined) args.push('--description', body.description);
  for (const r of roots)        args.push('--root', r);
  for (const p of presetIds)    args.push('--preset', p);
  try {
    const { stdout, code, stderr } = await runCli(args);
    if (code !== 0) {
      return NextResponse.json({ error: stderr || stdout || 'patch failed' }, { status: 500 });
    }
    const parsed = JSON.parse(stdout) as { ok: boolean; workspace: unknown };
    return NextResponse.json({ ok: parsed.ok, workspace: parsed.workspace });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { stdout, code, stderr } = await runCli(['workspace', 'remove', params.id]);
    if (code !== 0) {
      return NextResponse.json({ error: stderr || 'delete failed' }, { status: 500 });
    }
    const parsed = JSON.parse(stdout) as { ok: boolean; id: string };
    return NextResponse.json({ ok: parsed.ok, id: parsed.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
