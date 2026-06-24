// app/api/scan/route.ts — invoke the checkit CLI in a target directory and
// stream back the parsed JSON. This is the Node-side bridge equivalent to
// the Electron IPC — when running inside Electron, the renderer uses
// window.checkit (which spawns the same CLI). When running in a plain
// browser (dev preview, deployed web), this route is the fallback.

import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min for big repos

function cliBinary(): string {
  const candidates = [
    path.resolve(process.cwd(), '..', '..', 'packages', 'backend', 'dist', 'cli.cjs'),
    path.resolve(process.cwd(), '..', '..', '..', 'packages', 'backend', 'dist', 'cli.cjs'),
    path.resolve(process.cwd(), 'packages', 'backend', 'dist', 'cli.cjs'),
  ];
  for (const p of candidates) {
    try { if (require('node:fs').existsSync(p)) return p; } catch {}
  }
  throw new Error('Could not locate packages/backend/dist/cli.cjs — run `pnpm --filter @checkit/cli build` first');
}

export async function POST(req: Request) {
  let body: { cwd?: string; fix?: boolean; aiFix?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const cwd = body.cwd;
  if (!cwd) {
    return NextResponse.json({ ok: false, error: 'cwd is required' }, { status: 400 });
  }

  const args = [cwd];
  if (body.fix) args.push('--fix');
  if (body.aiFix) args.push('--ai-fix');
  args.push('--reporter', 'json');

  const bin = cliBinary();

  return new Promise<Response>((resolve) => {
    const child = spawn(process.execPath, [bin, ...args], {
      cwd,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c.toString('utf-8'); });
    child.stderr.on('data', (c) => { stderr += c.toString('utf-8'); });
    child.on('error', (e) => {
      resolve(NextResponse.json({ ok: false, error: e.message }, { status: 500 }));
    });
    child.on('close', (code) => {
      try {
        const issues = JSON.parse(stdout || '[]');
        resolve(NextResponse.json({ ok: true, exitCode: code, issues, stderr }));
      } catch (e: any) {
        resolve(NextResponse.json({ ok: false, exitCode: code, raw: stdout, stderr, parseError: e.message }, { status: 500 }));
      }
    });
  });
}