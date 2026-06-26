// app/api/presets/[id]/route.ts — PATCH (add/remove rules + usedIn workspaces) and DELETE.
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
  // Read the preset, falling back across scopes (project → global). We
  // use `show` (not `list` + filter) because show returns the full
  // preset incl. usedInWorkspaces, rules, and metadata.
  for (const scope of ['global', 'project'] as const) {
    const r = await runCli(['preset', 'show', params.id, '--scope', scope, '--json'])
      .catch((e) => ({ code: 1, stdout: '', stderr: (e as Error).message }));
    if (r.code === 0) {
      try {
        // `show` returns either { scope, preset } (found) or
        // { error: "preset \"...\" not found ..." } (not found, non-zero
        // exit). On code 0, a preset is always present.
        const parsed = JSON.parse(r.stdout) as { scope?: string; preset?: unknown; error?: string };
        if (parsed.preset && !parsed.error) {
          return NextResponse.json({ preset: parsed.preset, scope: parsed.scope });
        }
      } catch { /* fall through */ }
    }
  }
  return NextResponse.json({ error: 'preset not found' }, { status: 404 });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let body: { addRules?: string[]; removeRules?: string[]; addWorkspaces?: string[]; removeWorkspaces?: string[]; scope?: 'project' | 'global' } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const args = ['preset', 'update', params.id];
  if (body.scope) args.push('--scope', body.scope);
  for (const r of (body.addRules ?? []))        args.push('--add-rule', r);
  for (const r of (body.removeRules ?? []))     args.push('--remove-rule', r);
  for (const w of (body.addWorkspaces ?? []))   args.push('--used-in-workspaces', w);
  for (const w of (body.removeWorkspaces ?? [])) args.push('--not-used-in', w);
  try {
    const { stdout, code, stderr } = await runCli(args);
    if (code !== 0) {
      return NextResponse.json({ error: stderr || stdout || 'update failed' }, { status: 500 });
    }
    const parsed = JSON.parse(stdout) as { ok: boolean; preset: unknown };
    return NextResponse.json({ ok: parsed.ok, preset: parsed.preset });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { stdout, code, stderr } = await runCli(['preset', 'delete', params.id]);
    if (code !== 0) {
      return NextResponse.json({ error: stderr || 'delete failed' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: params.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
