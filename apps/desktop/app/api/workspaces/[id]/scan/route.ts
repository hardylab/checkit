// app/api/workspaces/[id]/scan/route.ts — trigger workspace scan.
import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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

function runCli(args: string[], timeoutMs: number = 240_000): Promise<{ stdout: string; stderr: string; code: number }> {
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
    const t = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`workspace scan timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(t);
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let body: { fix?: boolean } = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }
  const args = ['workspace', 'scan', params.id];
  if (body.fix) args.push('--fix');
  try {
    const { stdout, code, stderr } = await runCli(args);
    let result: unknown = null;
    try { result = JSON.parse(stdout); } catch {
      return NextResponse.json({ ok: false, error: `scan produced non-JSON: ${stdout.slice(0, 500)} | stderr: ${stderr.slice(0, 200)}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true, exitCode: code, result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
