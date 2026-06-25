// app/api/chat/route.ts — AI-powered chat responses.
//
// 调用 `lintany chat` CLI 子进程(走 packages/backend 的 ai-adapter 抽象),
// 让 Web UI 也能用真 LLM(local-keyword / openai / claude / minimax)。
//
// Fallback chain (per MSP §C3 — 离线契约):
//   1. 优先 lintany chat --no-tui --json  (spawn CLI binary)
//   2. CLI 不可达 / spawn 失败 → 旧 keyword dict (保留向后兼容)
//
// Env var auto-promote 由 CLI 内部完成(MINIMAX_API_KEY → minimax 等)。

import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { RULE_SETS, type RuleSet } from '../../lib/rule-sets';

/** POSIX shell-quote (single-quote + escape embedded single quotes).
 * Used only when we route through `cmd.exe /c "..."` on Windows.
 */
function shellQuote(s: string): string {
  // For cmd.exe, wrap in double quotes and escape internal " as "".
  // Messages shouldn't contain " but be defensive.
  return '"' + s.replace(/"/g, '""') + '"';
}

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface AiAdapterReply {
  reply: string;
  suggestions: Array<{ id: string; title: string; tldr?: string }>;
  recommendedSets: PresetRecommendation[];
  adapter?: string;
}

interface PresetRecommendation {
  id: string;
  name: string;
  description: string;
}

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
    } catch { /* not here, try next */ }
  }
  throw new Error('Could not locate packages/backend/dist/cli.cjs — run `pnpm --filter @checkit/cli build` first');
}

/** Spawn `lintany chat --no-tui --json <message>` and return parsed reply.
 *
 * stdout collection uses raw Buffer + iconv-lite-free heuristic: we
 * accumulate bytes and try UTF-8 first, then fall back to GBK if the
 * output contains a UTF-8 replacement character (a sign the bytes weren't
 * actually UTF-8). This avoids the mojibake you get when you blindly
 * decode Windows console output (default code page 936) as UTF-8.
 */
function callLintanyChat(message: string): Promise<AiAdapterReply> {
  return new Promise((resolve, reject) => {
    const bin = findCliBinary();
    // LINTANY_FORCE_UTF8_STDOUT=1 tells the CLI child to write raw UTF-8
    // bytes to stdout, bypassing Node's console code page handling.
    //
    // We pass the user message by writing it to a temp file (UTF-8 bytes)
    // and passing the file path via env LINTANY_CHAT_MESSAGE_FILE. This
    // sidesteps Node's spawn-arg encoding on Windows (cp936/GBK) which
    // would mojibake Chinese characters before they reach the child.
    //
    // Stdin is also a clean path (UTF-8 by default), but the child CLI
    // has existing argv handling we don't want to disturb. File-path
    // via env is the most reliable.
    //
    // TODO: when the desktop /api/chat and CLI share a workspace, switch
    // to direct in-process import of @checkit/cli for ~zero overhead.
    const fs = require('node:fs') as typeof import('node:fs');
    const os = require('node:os') as typeof import('node:os');
    const path = require('node:path') as typeof import('node:path');
    const tmpFile = path.join(os.tmpdir(), `lintany-msg-${Date.now()}-${process.pid}.txt`);
    fs.writeFileSync(tmpFile, message, 'utf-8');
    // Debug: confirm the message was written correctly.
    // eslint-disable-next-line no-console
    console.warn(`[chat-debug] wrote ${message.length} chars to ${tmpFile}; first16 hex of file: ${fs.readFileSync(tmpFile).slice(0, 16).toString('hex')}`);
    const child = spawn(process.execPath, [bin, 'chat', '--no-tui', '--json'], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        LINTANY_FORCE_UTF8_STDOUT: '1',
        LINTANY_CHAT_MESSAGE_FILE: tmpFile,
      },
      windowsHide: true,
    });
    // Cleanup the temp file once the child closes.
    child.on('close', () => {
      try { fs.unlinkSync(tmpFile); } catch { /* best effort */ }
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout.on('data', (c: Buffer) => { stdoutChunks.push(c); });
    child.stderr.on('data', (c: Buffer) => { stderrChunks.push(c); });
    child.on('error', reject);
    child.on('close', (code) => {
      const stdoutBuf = Buffer.concat(stdoutChunks);
      const stderrBuf = Buffer.concat(stderrChunks);
      // Debug: report first 16 bytes hex so we can see if child emitted GBK or UTF-8.
      const first16 = stdoutBuf.slice(0, 16).toString('hex');
      // Try UTF-8 first; if it produces a replacement char, fall back to GBK.
      let stdout = stdoutBuf.toString('utf-8');
      if (stdout.includes('\uFFFD')) {
        try {
          // Use Node's built-in TextDecoder for GBK fallback (iconv-lite isn't
          // a dep — Node's TextDecoder supports 'gbk' on modern versions).
          stdout = new TextDecoder('gbk').decode(stdoutBuf);
        } catch {
          // Last resort: keep utf-8 with replacement chars.
        }
      }
      const stderr = stderrBuf.toString('utf-8');
      const trimmed = stdout.trim();
      if (!trimmed) {
        reject(new Error(`lintany chat exited ${code} with no stdout. stderr=${stderr.slice(0, 200)}`));
        return;
      }
      try {
        const parsed = JSON.parse(trimmed);
        resolve(parsed as AiAdapterReply);
      } catch {
        // Debug: include first16 hex to diagnose GBK/UTF-8 mismatch.
        reject(new Error(`lintany chat emitted non-JSON: first16=${first16} body=${trimmed.slice(0, 200)}`));
      }
    });
  });
}

// Mirror the catalog API: each rule has id, title, tags, category, severity, tldr.
type RuleDoc = {
  id: string;
  title: string;
  tags: string[];
  severity: string;
  category: string;
  tldr: string;
};

async function loadCatalog(): Promise<RuleDoc[]> {
  try {
    const file = path.join(process.cwd(), 'app', 'lib', 'rules-catalog.json');
    const raw = await fs.readFile(file, 'utf-8');
    return JSON.parse(raw) as RuleDoc[];
  } catch {
    return [];
  }
}

/**
 * Translate the CLI ChatReply (id/title/tldr) shape into the desktop
 * RuleDoc shape (with tags/category/severity) by joining against the
 * bundled catalog. CLI shape is leaner; the desktop UI shows richer cards.
 */
function toRuleDocs(suggestions: AiAdapterReply['suggestions'], catalog: RuleDoc[]): RuleDoc[] {
  const byId = new Map(catalog.map((r) => [r.id, r]));
  const out: RuleDoc[] = [];
  for (const s of suggestions) {
    const found = byId.get(s.id);
    if (found) {
      out.push(found);
    } else {
      out.push({
        id: s.id,
        title: s.title,
        tags: [],
        severity: 'warning',
        category: 'unknown',
        tldr: s.tldr ?? '',
      });
    }
  }
  return out;
}

function toRuleSets(recommended: AiAdapterReply['recommendedSets']): RuleSet[] {
  const byId = new Map(RULE_SETS.map((s) => [s.id, s]));
  const out: RuleSet[] = [];
  for (const r of recommended) {
    const found = byId.get(r.id);
    if (found) {
      out.push(found);
    } else {
      out.push({
        id: r.id,
        name: r.name,
        category: 'unknown',
        description: r.description,
        icon: '星',
        ruleIds: [],
        source: 'community',
        featured: false,
        installs: 0,
        rating: 0,
        updatedDays: 0,
      });
    }
  }
  return out;
}

export async function POST(req: Request) {
  let body: { message?: string; history?: Array<{ role: 'user' | 'assistant'; text: string }> } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const message = (body.message ?? '').trim();
  if (!message) return NextResponse.json({ error: 'Empty message' }, { status: 400 });

  // Try the real LLM first.
  let llmError: string | null = null;
  try {
    const ai = await callLintanyChat(message);
    const catalog = await loadCatalog();
    return NextResponse.json({
      reply: ai.reply,
      recommendations: toRuleDocs(ai.suggestions ?? [], catalog),
      recommendedSets: toRuleSets(ai.recommendedSets ?? []),
      matches: [],
      adapter: ai.adapter,
    });
  } catch (e) {
    // LLM path failed — fall through to keyword fallback below.
    llmError = (e as Error).message;
    // Debug: include hex prefix so we can see if child emitted GBK or UTF-8.
    llmError += ` [stdout-first16-hex=${(e as Error).message.match(/first16=([0-9a-f]+)/)?.[1] ?? 'n/a'}]`;
    // eslint-disable-next-line no-console
    console.warn(`[chat] LLM path failed: ${llmError}`);
  }

  // Fallback: keyword dict (legacy path).
  // Note: we surface the LLM error in `llmError` field so the UI can
  // show "set MINIMAX_API_KEY to enable real LLM" hints.
  const messageLower = message.toLowerCase();
  const match = FALLBACK_KEYWORDS.find((g) => g.keys.some((k) => messageLower.includes(k.toLowerCase())))
    ?? { keys: [], ruleIds: [], setIds: [], reply: 'Tell me about the kind of checks you want (security, TypeScript, formatting, tests, …) and I will recommend a preset.' };
  const catalog = await loadCatalog();
  const byId = new Map(catalog.map((r) => [r.id, r]));
  const recommendations = match.ruleIds.map((id) => byId.get(id)).filter(Boolean) as RuleDoc[];
  const setById = new Map(RULE_SETS.map((s) => [s.id, s]));
  const recommendedSets = match.setIds.map((id) => setById.get(id)).filter(Boolean) as RuleSet[];

  return NextResponse.json({
    reply: match.reply,
    recommendations,
    recommendedSets,
    matches: match.keys,
    adapter: 'fallback-keyword',
    llmError,
  });
}

// Legacy keyword dict — kept as offline fallback only. Live responses
// come from `lintany chat` (which itself uses local-keyword adapter when
// no API key is configured). The two paths will usually agree on which
// rules/presets to recommend; the LLM path just adds natural-language reply.
const FALLBACK_KEYWORDS: Array<{ keys: string[]; ruleIds: string[]; setIds: string[]; reply: string }> = [
  {
    keys: ['sql', '注入', 'sqli', 'sql injection', 'nosql', 'orm'],
    ruleIds: [],
    setIds: [],
    reply: '我们的 catalog 里目前没有专门的 SQL 注入规则(no-sql-injection)。可以加一条 — 我可以帮你写一段规则检测拼接查询,你要我现在起草吗?',
  },
  {
    keys: ['密钥', '凭证', '硬编码', 'aws', 'token', 'credential', 'secret', 'password', 'api key', 'api_key', 'security', '安全'],
    ruleIds: ['plaintext-credentials', 'git-no-secrets-in-history', 'env-var-check'],
    setIds: ['security-baseline'],
    reply: '**安全基线** 是每个项目应该装的第一个 set。它把硬编码密钥 / git 历史泄漏 / 敏感文件一次扫干净:',
  },
  {
    keys: ['typescript', 'ts strict', 'strict mode', 'strict', '类型', 'type', 'any', 'ts'],
    ruleIds: ['no-any-rule', 'no-magic-numbers'],
    setIds: ['ts-strict'],
    reply: '**TypeScript 严格** set 把 no-any / no-magic / 强类型 全打开:',
  },
];
