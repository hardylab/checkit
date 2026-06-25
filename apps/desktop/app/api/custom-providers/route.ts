// app/api/custom-providers/route.ts — Manage custom LLM providers.
//
// These are user-defined providers (deepseek / doubao / moonshot / etc.)
// that should appear in the Settings modal's Provider dropdown alongside
// the built-in ones (openai / claude / minimax / ollama). They live in
// ~/.checkit/custom-providers/<id>.json.
//
// GET    /api/custom-providers            — list all
// POST   /api/custom-providers            — add or update (body: { id, name, baseUrl, defaultModel? })
// DELETE /api/custom-providers?id=<id>    — remove
//
// Custom providers only carry the public config (no API key — that lives
// in the global config.json so it isn't duplicated across providers).

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
  throw new Error('Could not locate packages/backend/dist/cli.cjs — run `pnpm --filter @checkit/cli build` first');
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
    const { stdout, code, stderr } = await runCli(['custom-provider', 'list']);
    if (code !== 0) {
      return NextResponse.json({ error: `list failed: ${stderr}` }, { status: 500 });
    }
    const parsed = JSON.parse(stdout) as { providers: Array<{ id: string; name: string; baseUrl: string; defaultModel: string }> };
    return NextResponse.json({ providers: parsed.providers ?? [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: { id?: string; name?: string; baseUrl?: string; defaultModel?: string } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  if (!body.baseUrl) return NextResponse.json({ error: 'baseUrl is required' }, { status: 400 });
  try {
    const args = [
      'custom-provider', 'add', body.id,
      '--name', body.name ?? body.id,
      '--base-url', body.baseUrl,
    ];
    if (body.defaultModel) args.push('--default-model', body.defaultModel);
    const { stdout, code, stderr } = await runCli(args);
    if (code !== 0) {
      return NextResponse.json({ error: stderr || stdout || 'add failed' }, { status: 500 });
    }
    const parsed = JSON.parse(stdout) as { ok: boolean; provider: unknown };
    return NextResponse.json({ ok: parsed.ok, provider: parsed.provider });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id query param required' }, { status: 400 });
  try {
    const { stdout, code, stderr } = await runCli(['custom-provider', 'remove', id]);
    if (code !== 0) {
      return NextResponse.json({ error: stderr || 'remove failed' }, { status: 500 });
    }
    const parsed = JSON.parse(stdout) as { ok: boolean; id: string };
    return NextResponse.json({ ok: parsed.ok, id: parsed.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
