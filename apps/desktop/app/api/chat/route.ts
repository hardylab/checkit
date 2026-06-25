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

/** Spawn `lintany chat --no-tui --json <message>` and return parsed reply. */
function callLintanyChat(message: string): Promise<AiAdapterReply> {
  return new Promise((resolve, reject) => {
    const bin = findCliBinary();
    const child = spawn(process.execPath, [bin, 'chat', '--no-tui', '--json', message], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c.toString('utf-8'); });
    child.stderr.on('data', (c) => { stderr += c.toString('utf-8'); });
    child.on('error', reject);
    child.on('close', (code) => {
      // Empty message → CLI emits {} object; parse robustly.
      const trimmed = stdout.trim();
      if (!trimmed) {
        reject(new Error(`lintany chat exited ${code} with no stdout. stderr=${stderr.slice(0, 200)}`));
        return;
      }
      try {
        const parsed = JSON.parse(trimmed);
        resolve(parsed as AiAdapterReply);
      } catch {
        reject(new Error(`lintany chat emitted non-JSON: ${trimmed.slice(0, 200)}`));
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
    // eslint-disable-next-line no-console
    console.warn(`[chat] LLM path failed: ${(e as Error).message}`);
  }

  // Fallback: keyword dict (legacy path).
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
