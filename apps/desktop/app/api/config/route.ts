// app/api/config/route.ts — GET / PUT global LintAny config from ~/.checkit/config.json.
//
// Allows the desktop UI to read/write the same config the CLI uses.
// Config keys supported (per MSP §C1 / global.ts schema):
//   - ai.adapter   (string)   local-keyword | openai | claude | minimax | ...
//   - ai.model     (string)   e.g. "gpt-4o-mini", "claude-sonnet-4-5", "MiniMax-M3"
//   - ai.api_key   (string)   the provider secret key
//   - ai.base_url  (string)   override default endpoint (Azure/Together/OpenRouter/...)
//   - theme        (string)   light | dark
//   - locale       (string)   e.g. zh-CN

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

/** Spawn `lintany config <sub>` and return parsed JSON. */
function runConfigCli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const bin = findCliBinary();
    const child = spawn(process.execPath, [bin, 'config', ...args, '--json'], {
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

const ALLOWED_KEYS = new Set(['ai.adapter', 'ai.model', 'ai.api_key', 'ai.base_url', 'theme', 'locale']);

export async function GET() {
  try {
    const { stdout, code } = await runConfigCli(['list']);
    if (code !== 0) {
      return NextResponse.json({ error: 'config list failed' }, { status: 500 });
    }
    // The CLI prints JSON shape: { keys: ["ai.adapter", ...], file: "..." }
    // (not the text format used without --json).
    let parsed: { keys?: string[]; file?: string } = {};
    try { parsed = JSON.parse(stdout); } catch {
      return NextResponse.json({ error: 'config list returned non-JSON: ' + stdout.slice(0, 200) }, { status: 500 });
    }
    const file = parsed.file || '';
    // Re-read each key individually via `config get <key>`. Two-step but
    // gives us clean values without parsing the text output.
    const config: Record<string, string> = {};
    for (const k of parsed.keys ?? []) {
      if (!ALLOWED_KEYS.has(k)) continue;
      try {
        const { stdout: vStdout, code: vCode } = await runConfigCli(['get', k, '--json']);
        if (vCode === 0) {
          try {
            // shape: { key, found, value }
            const g = JSON.parse(vStdout) as { value?: unknown };
            if (g.value !== undefined && g.value !== null) {
              config[k] = String(g.value);
            }
          } catch { /* skip unparseable */ }
        }
      } catch { /* skip individual get failures */ }
    }
    return NextResponse.json({ config, file });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  let body: { key?: string; value?: unknown; deletes?: string[] } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { key, value, deletes } = body;
  const keysToWrite: string[] = [];
  if (key) keysToWrite.push(key);
  if (Array.isArray(deletes)) keysToWrite.push(...deletes);

  if (keysToWrite.length === 0) {
    return NextResponse.json({ error: 'no key or deletes provided' }, { status: 400 });
  }
  for (const k of keysToWrite) {
    if (!ALLOWED_KEYS.has(k)) {
      return NextResponse.json({ error: `key not allowed: ${k}` }, { status: 400 });
    }
  }

  try {
    // For each key: if a value is provided, set it; if it's in `deletes`, unset it.
    for (const k of keysToWrite) {
      if (Array.isArray(deletes) && deletes.includes(k)) {
        const { code, stderr } = await runConfigCli(['unset', k]);
        if (code !== 0) {
          return NextResponse.json({ error: `unset ${k} failed: ${stderr}` }, { status: 500 });
        }
      } else if (key === k && value !== undefined) {
        const { code, stderr } = await runConfigCli(['set', k, String(value)]);
        if (code !== 0) {
          return NextResponse.json({ error: `set ${k} failed: ${stderr}` }, { status: 500 });
        }
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
