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

export async function POST(req: Request) {
  // Body shape (one of):
  //   1) { key, value, withTest? }                    — single write
  //   2) { deletes: [k1, k2, ...], withTest? }        — single batch delete
  //   3) { batch: { sets: [...], deletes: [...], withTest? } }
  //      — atomic write of many keys, then optionally test.
  //      All sets run first, then all deletes, then the test (if any).
  //      On test failure, every key set in this request is rolled back.
  let body: {
    key?: string;
    value?: unknown;
    deletes?: string[];
    withTest?: boolean;
    batch?: {
      sets?: Array<{ key: string; value: string }>;
      deletes?: string[];
      withTest?: boolean;
    };
  } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // Normalize into a uniform plan.
  let sets: Array<{ key: string; value: string }> = [];
  let deletes: string[] = [];
  let withTest = false;
  if (body.batch) {
    if (Array.isArray(body.batch.sets)) sets = body.batch.sets;
    if (Array.isArray(body.batch.deletes)) deletes = body.batch.deletes;
    if (body.batch.withTest) withTest = true;
  } else {
    if (body.key && body.value !== undefined) sets = [{ key: body.key, value: String(body.value) }];
    if (Array.isArray(body.deletes)) deletes = body.deletes;
    if (body.withTest) withTest = true;
  }

  const allKeys = [...sets.map((s) => s.key), ...deletes];
  if (allKeys.length === 0) {
    return NextResponse.json({ error: 'no key or deletes provided' }, { status: 400 });
  }
  for (const k of allKeys) {
    if (!ALLOWED_KEYS.has(k)) {
      return NextResponse.json({ error: `key not allowed: ${k}` }, { status: 400 });
    }
  }

  // Snapshot the keys we plan to set so we can roll them back on test
  // failure (best-effort — we don't know the prior values, but a fresh
  // unset is safer than leaving half-written config behind).
  const keysToRollback = sets.map((s) => s.key);

  try {
    // Sets first.
    for (const s of sets) {
      const { code, stderr } = await runConfigCli(['set', s.key, s.value]);
      if (code !== 0) {
        return NextResponse.json({ error: `set ${s.key} failed: ${stderr}` }, { status: 500 });
      }
    }
    // Then deletes.
    for (const k of deletes) {
      const { code, stderr } = await runConfigCli(['unset', k]);
      if (code !== 0) {
        return NextResponse.json({ error: `unset ${k} failed: ${stderr}` }, { status: 500 });
      }
    }
    if (!withTest) {
      return NextResponse.json({ ok: true });
    }
    // ─── Test the freshly-written config by pinging the LLM. ───────
    const { stdout, code, stderr } = await runConfigCli(['test', '--json']);
    let testResult: { ok?: boolean; adapter?: string; error?: string; reply?: string } = {};
    try { testResult = JSON.parse(stdout); } catch {
      return NextResponse.json({ ok: false, error: `config test produced non-JSON: ${stderr.slice(0, 200) || stdout.slice(0, 200)}` }, { status: 502 });
    }
    if (code !== 0 || !testResult.ok) {
      // Roll back the keys we set. Deletes are user-explicit and we
      // don't know the prior state — leave them alone.
      for (const k of keysToRollback) {
        try { await runConfigCli(['unset', k]); } catch { /* ignore */ }
      }
      return NextResponse.json({
        ok: false,
        adapter: testResult.adapter,
        error: testResult.error || `config test failed for ${testResult.adapter}`,
        rolledBack: keysToRollback.length > 0,
      }, { status: 502 });
    }
    return NextResponse.json({ ok: true, adapter: testResult.adapter, reply: testResult.reply });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// PUT alias — backward-compat with the original handler. Both go through
// the same `withTest` logic.
export const PUT = POST;
