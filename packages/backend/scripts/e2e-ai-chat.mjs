// scripts/e2e-ai-chat.mjs — strict e2e test for the AI chat path.
//
// Verifies (in order, fail-fast):
//   1. CLI direct: `lintany chat --no-tui --json` with no env key → local-keyword adapter, valid shape
//   2. CLI direct: empty message → empty reply shape, exit 0
//   3. CLI direct: invalid adapter → clean error, exit 1
//   4. CLI direct: real key via MINIMAX_API_KEY env → minimax adapter, real LLM reply
//   5. Desktop proxy: POST /api/chat with no env → falls through to local-keyword (LLM path still works)
//   6. Desktop proxy: POST /api/chat with real key + real message → adapter: 'minimax'
//   7. Desktop proxy: POST /api/chat with malformed JSON → 400
//   8. Desktop proxy: POST /api/chat with empty message → 400
//
// Run: `node scripts/e2e-ai-chat.mjs` from packages/backend/
// Or with key file: `node scripts/e2e-ai-chat.mjs --key-file=/path/to/key`
//
// Exit code 0 = all green. Non-zero = first failure + diagnostic.

import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(__dirname, '..', 'dist', 'cli.cjs');
const DESKTOP = process.env.DESKTOP_URL ?? 'http://localhost:3000';

// Inject key from --key-file=<path> to avoid shell quoting issues with
// tokens like '*'. Skips if already in env.
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--key-file=')) {
    const fp = arg.slice('--key-file='.length);
    const key = readFileSync(fp, 'utf-8').trim();
    process.env.MINIMAX_API_KEY = key;
    break;
  }
}

// Dev convenience: read .env.example for any key not already in env.
const envExample = path.resolve(__dirname, '..', '..', '.env.example');
if (existsSync(envExample)) {
  for (const line of readFileSync(envExample, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const hasKey = !!process.env.MINIMAX_API_KEY && process.env.MINIMAX_API_KEY.length > 10;

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

function ok(name) {
  passed++;
  console.log(`  ✓ ${name}`);
}
function bad(name, detail) {
  failed++;
  failures.push({ name, detail });
  console.log(`  ✗ ${name}`);
  console.log(`      ${detail.split('\n').join('\n      ')}`);
}
function skip(name, reason) {
  skipped++;
  console.log(`  - ${name}  (skipped: ${reason})`);
}

function spawnCli(args, env = {}) {
  return new Promise((resolve, reject) => {
    if (!existsSync(CLI)) {
      return reject(new Error(`CLI not built: ${CLI} - run 'pnpm build' first`));
    }
    const child = spawn(process.execPath, [CLI, ...args], {
      env: { ...process.env, ...env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c.toString('utf-8'); });
    child.stderr.on('data', (c) => { stderr += c.toString('utf-8'); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ stdout, stderr, code }));
  });
}

async function postChat(message) {
  const resp = await fetch(`${DESKTOP}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  let json = null;
  try { json = await resp.json(); } catch { /* not json */ }
  return { status: resp.status, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

async function step(name, fn) {
  try {
    await fn();
    ok(name);
  } catch (e) {
    bad(name, (e instanceof Error ? e.message : String(e)).slice(0, 800));
  }
}

async function main() {
  console.log(`\nLintAny / Checkit AI Chat - strict e2e`);
  console.log(`CLI:      ${CLI}`);
  console.log(`Desktop:  ${DESKTOP}`);
  console.log(`MiniMax key: ${hasKey ? 'present (len=' + process.env.MINIMAX_API_KEY.length + ')' : 'absent - LLM steps will be skipped'}\n`);

  // 1. CLI direct - local-keyword (no key needed; strip keys to force offline path)
  await step('CLI direct: local-keyword returns valid ChatReply shape', async () => {
    const r = await spawnCli(['chat', '--no-tui', '--json', 'credential'], {
      MINIMAX_API_KEY: '', OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '',
    });
    assert(r.code === 0, `expected exit 0, got ${r.code}. stderr=${r.stderr.slice(0, 200)}`);
    const j = JSON.parse(r.stdout);
    assert(typeof j.reply === 'string', `reply must be string, got ${typeof j.reply}`);
    assert(Array.isArray(j.suggestions), 'suggestions must be array');
    assert(Array.isArray(j.recommendedSets), 'recommendedSets must be array');
    assert(j.adapter === 'local-keyword', `adapter should be local-keyword, got ${j.adapter}. full=${JSON.stringify(j).slice(0, 200)}`);
    assert(j.suggestions.length > 0, 'local-keyword should return at least one suggestion for "credential"');
    const ids = j.suggestions.map((s) => s.id);
    assert(ids.includes('plaintext-credentials'), `expected plaintext-credentials in ${ids.join(',')}`);
  });

  // 2. CLI direct - empty message
  await step('CLI direct: empty message -> exit 0 with empty reply', async () => {
    const r = await spawnCli(['chat', '--no-tui', '--json', '   ']);
    assert(r.code === 0, `expected exit 0, got ${r.code}. stderr=${r.stderr.slice(0, 200)}`);
    const j = JSON.parse(r.stdout);
    assert(j.reply === '', `expected empty reply, got ${JSON.stringify(j.reply)}`);
    assert(j.suggestions.length === 0, 'expected no suggestions for empty input');
    assert(j.adapter === 'local-keyword', `adapter should be local-keyword, got ${j.adapter}`);
  });

  // 3. CLI direct - invalid adapter
  await step('CLI direct: invalid adapter -> exit 1 with helpful error', async () => {
    const r = await spawnCli(['chat', '--no-tui', '--json', '--adapter', 'bogus', 'hi']);
    assert(r.code === 1, `expected exit 1, got ${r.code}`);
    const j = JSON.parse(r.stdout);
    assert(typeof j.error === 'string' && j.error.length > 0, 'expected error field in JSON');
    assert(/unknown adapter/i.test(j.error), `error should mention unknown adapter: ${j.error}`);
    assert(/local-keyword/.test(j.error), `error should suggest local-keyword fallback: ${j.error}`);
  });

  // 4. CLI direct - real LLM (skipped if no key)
  if (!hasKey) {
    skip('CLI direct: real MiniMax LLM returns non-template reply', 'MINIMAX_API_KEY not set');
  } else {
    await step('CLI direct: real MiniMax LLM returns non-template reply', async () => {
      const r = await spawnCli(['chat', '--no-tui', '--json', 'I want security checks for credential leaks']);
      assert(r.code === 0, `expected exit 0, got ${r.code}. stderr=${r.stderr.slice(0, 300)}`);
      const j = JSON.parse(r.stdout);
      assert(j.adapter === 'minimax', `adapter should be minimax, got ${j.adapter}`);
      assert(typeof j.reply === 'string' && j.reply.length > 20, `reply too short (${j.reply.length} chars), likely template: ${j.reply.slice(0, 100)}`);
      assert(!/^Matched \d+ preset/.test(j.reply), `reply looks like local-keyword template, not LLM: ${j.reply.slice(0, 100)}`);
      assert(j.suggestions.length > 0, 'LLM should recommend at least one rule');
      const ids = j.suggestions.map((s) => s.id);
      assert(ids.includes('plaintext-credentials'), `expected plaintext-credentials in LLM response: ${ids.join(',')}`);
    });
  }

  // 5. Desktop proxy - local-keyword fallback
  await step('Desktop proxy: POST /api/chat without env key -> local-keyword via CLI', async () => {
    const r = await postChat('credential');
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert(r.json, 'expected JSON body');
    assert(['local-keyword', 'fallback-keyword'].includes(r.json.adapter), `unexpected adapter: ${r.json.adapter}`);
    assert(typeof r.json.reply === 'string' && r.json.reply.length > 0, 'reply must be non-empty');
    assert(Array.isArray(r.json.recommendations), 'recommendations must be array');
    assert(Array.isArray(r.json.recommendedSets), 'recommendedSets must be array');
  });

  // 6. Desktop proxy - real LLM (skipped if no key)
  if (!hasKey) {
    skip('Desktop proxy: POST /api/chat with real key -> adapter: minimax', 'MINIMAX_API_KEY not set');
  } else {
    await step('Desktop proxy: POST /api/chat with real key -> adapter: minimax', async () => {
      const r = await postChat('I want security checks for credential leaks');
      assert(r.status === 200, `expected 200, got ${r.status}. body=${JSON.stringify(r.json).slice(0, 200)}`);
      assert(r.json.adapter === 'minimax', `adapter should be minimax, got ${r.json.adapter}`);
      assert(typeof r.json.reply === 'string' && r.json.reply.length > 20, `reply too short: ${r.json.reply.slice(0, 100)}`);
      assert(!/^Matched \d+ preset/.test(r.json.reply), `reply looks like template: ${r.json.reply.slice(0, 100)}`);
      const ids = (r.json.recommendations ?? []).map((s) => s.id);
      assert(ids.includes('plaintext-credentials'), `expected plaintext-credentials in desktop response: ${ids.join(',')}`);
    });
  }

  // 7. Desktop proxy - malformed JSON
  await step('Desktop proxy: malformed JSON body -> 400', async () => {
    const resp = await fetch(`${DESKTOP}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });
    assert(resp.status === 400, `expected 400, got ${resp.status}`);
  });

  // 8. Desktop proxy - empty message
  await step('Desktop proxy: empty message -> 400', async () => {
    const r = await postChat('   ');
    assert(r.status === 400, `expected 400, got ${r.status}`);
    assert(r.json?.error, 'expected error field');
  });

  console.log(`\nResult: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  if (failed > 0) {
    console.log(`\nFailures:`);
    for (const f of failures) {
      console.log(`  - ${f.name}`);
      console.log(`      ${f.detail}`);
    }
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('e2e runner crashed:', e);
  process.exit(2);
});
