// app/api/chat/route.ts — keyword-matched scripted chat responses.
//
// Design decision (per docs/plans/2026-06-23-chat-tab-and-rule-drawer-design.md D1):
//   This is a scripted demo, not a real LLM. We match keywords in the user
//   message against our existing rule catalog AND rule-set catalog and
//   return recommended cards + a short reply.
//
// Why scripted:
//   - checkit is a CLI + Web app, no LLM backend.
//   - Static Next.js can call OpenAI/Anthropic but needs API keys + CORS
//     proxy in Electron. Not worth wiring for V1.
//   - The UX is still real: user types → keywords matched → set/rule cards
//     rendered → one-click install. The "AI" lives in the user's head.

import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { RULE_SETS, type RuleSet } from '../../lib/rule-sets';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Mirror the catalog API: each rule has id, title, tags, category, severity, tldr.
type RuleDoc = {
  id: string;
  title: string;
  tags: string[];
  severity: string;
  category: string;
  tldr: string;
};

// Keyword → rule id(s) + set id(s) mapping. Order matters: first match wins
// per rule, but we surface all matches. Add new entries freely.
const KEYWORDS: Array<{ keys: string[]; ruleIds: string[]; setIds: string[]; reply: string }> = [
  {
    keys: ['sql', '注入', 'sqli', 'sql injection', 'nosql', 'orm'],
    ruleIds: [],  // no sql-injection rule in current catalog
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
    keys: ['react', '渲染', 'memo', 'usememo', 'usecallback', 'usestate', 'useref', 'hook', 'component'],
    ruleIds: [],
    setIds: [],
    reply: '我们当前 catalog 没专门的 React hook 规则。可以加:useEffect 依赖检查、useMemo 冗余检测、keys 缺失检查。你想让我起草哪一条?',
  },
  {
    keys: ['eslint', 'preset', '规则集', 'ruleset', 'config', '帮我配', '装一套', '配一套'],
    ruleIds: [],
    setIds: ['security-baseline', 'ts-strict', 'file-hygiene'],
    reply: '**入门三连** — 这三个 set 是新人第一天就要装的:',
  },
  {
    keys: ['any', '类型', 'typescript', 'ts', '类型安全', 'typesafe', 'strict'],
    ruleIds: ['no-any-rule', 'no-magic-numbers', 'require-tsconfig-no-emit', 'require-tsconfig-one-way-references', 'no-circular-dependency'],
    setIds: ['ts-strict'],
    reply: '**TS 严格增强** — 装这一个 set 就拿到 5 条规则:',
  },
  {
    keys: ['依赖', 'dependency', 'dep', 'package', '包', '漏洞', 'vulnerability', 'license', 'config'],
    ruleIds: ['gitignore-sensitive-required', 'git-ignore-required'],
    setIds: ['config-safety', 'file-hygiene'],
    reply: '依赖卫生 / 配置安全 — 推荐这两个 set:',
  },
  {
    keys: ['format', 'prettier', '格式', '缩进', 'tab', 'indent'],
    ruleIds: ['tab-size-two-spaces', 'recent-files-format', 'utf8-encoding-required'],
    setIds: ['file-hygiene', 'freshness'],
    reply: '格式 / 文件卫生 — 这两个 set 把风格统一、缩进、编码一致性问题一次解决:',
  },
  {
    keys: ['测试', 'test', 'spec', 'coverage', '覆盖'],
    ruleIds: ['require-test-file', 'group-test-files', 'spec-traceability-check'],
    setIds: ['test-coverage'],
    reply: '**测试基线** — 一个 set 搞定测试文件 / 测试目录 / spec 追踪三件事:',
  },
  {
    keys: ['文件', 'file', '结构', 'naming', '命名', 'git', '卫生', 'hygiene'],
    ruleIds: ['filename-naming-rule', 'doc-pattern', 'git-ignore-required', 'gitignore-sensitive-required', 'git-no-large-files', 'git-no-secrets-in-history', 'tab-size-two-spaces', 'utf8-encoding-required'],
    setIds: ['file-hygiene', 'security-baseline'],
    reply: '文件卫生 — 这是「**文件卫生** + **安全基线**」组合,团队第一天就该装的:',
  },
  {
    keys: ['架构', 'architecture', 'import', '循环', 'circular', 'index', 'entry', 'barrel'],
    ruleIds: ['index-only-exports', 'require-index-export', 'entry-point-no-logic', 'no-circular-dependency', 'flow-naming-rule'],
    setIds: ['module-boundaries'],
    reply: '**模块边界守门** — 装这一个 set 就强迫模块结构干净:',
  },
  {
    keys: ['log', 'console.log', 'debug', '打印', 'console'],
    ruleIds: ['no-console-log'],
    setIds: ['code-cleanup'],
    reply: '**代码整洁** set 里包含 no-console-log,自动 fix 删除那一行:',
  },
  {
    keys: ['function', 'size', '长函数', '函数', '复杂', 'cyclomatic', 'if', 'else', '条件', '分支', '整洁', 'cleanup'],
    ruleIds: ['function-size-limit', 'many-conditions-rule'],
    setIds: ['code-cleanup'],
    reply: '**代码整洁** — 函数大小 + 圈复杂度一起:',
  },
  {
    keys: ['doc', '文档', 'markdown', 'frontmatter', 'okf'],
    ruleIds: ['okf-compliance'],
    setIds: ['docs-quality'],
    reply: '**文档质量** — 让 .md 都带 OKF frontmatter,AI agent 能解析:',
  },
  {
    keys: ['hello', 'hi', '你好', '在吗', 'help', '帮助', 'what', '能做'],
    ruleIds: [],
    setIds: ['security-baseline', 'ts-strict', 'file-hygiene'],
    reply: '我能帮你在 10 个 set / 29 条规则里找最适合的。试试:**SQL / 密钥 / React / TypeScript / 依赖 / 测试 / 文件 / 架构 / console.log / 函数**。',
  },
];

const DEFAULT_REPLY = '我没完全听懂你想要的。试试这些关键词之一:**SQL / 密钥 / React / TypeScript / 依赖 / 测试 / 文件 / 架构 / console.log / 函数**。或者直接说「我想做 X」也行。';

async function loadCatalog(): Promise<RuleDoc[]> {
  // Walk the rules dir like /api/rules does, but inline so we don't refetch.
  const root = findRulesRoot();
  const out: RuleDoc[] = [];
  async function walk(dir: string, catPath: string[]) {
    let entries: Awaited<ReturnType<typeof fs.readdir>>;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full, [...catPath, entry.name]);
      else if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('README')) {
        const stem = entry.name.replace(/\.md$/, '');
        if (catPath.length !== 2 || catPath[1] !== stem) continue;
        try {
          const md = await fs.readFile(full, 'utf-8');
          const m = md.match(/^---\n([\s\S]*?)\n---/);
          if (!m) continue;
          const meta: Record<string, string> = {};
          for (const line of m[1].split('\n')) {
            const kv = line.match(/^([\w-]+):\s*(.*)$/);
            if (kv) meta[kv[1]] = kv[2].trim().replace(/^['"]|['"]$/g, '');
          }
          if (!meta.name) continue;
          out.push({
            id: catPath[1],
            title: meta.title ?? catPath[1],
            tags: (meta.tags ?? '').split(',').map((s) => s.trim()).filter(Boolean),
            severity: meta.severity === 'warn' ? 'warning' : (meta.severity ?? 'warning'),
            category: catPath[0] ?? 'other',
            tldr: extractTldr(md),
          });
        } catch {}
      }
    }
  }
  await walk(root, []);
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function findRulesRoot(): string {
  const candidates = [
    path.resolve(process.cwd(), '..', '..', 'packages', 'backend', 'src', 'rules'),
    path.resolve(process.cwd(), '..', '..', '..', 'packages', 'backend', 'src', 'rules'),
    path.resolve(process.cwd(), 'packages', 'backend', 'src', 'rules'),
  ];
  for (const p of candidates) {
    try { if (require('node:fs').existsSync(p)) return p; } catch {}
  }
  throw new Error('Could not locate packages/backend/src/rules');
}

function extractTldr(md: string): string {
  const m = md.replace(/^---[\s\S]*?---\n/, '').match(/##\s*TL;DR\s*\n+([\s\S]*?)(?:\n##|\n*$)/);
  if (!m) return '';
  return m[1].replace(/`([^`]+)`/g, '$1').replace(/\n+/g, ' ').trim().slice(0, 200);
}

export async function POST(req: Request) {
  let body: { message?: string; history?: Array<{ role: 'user' | 'assistant'; text: string }> } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const message = (body.message ?? '').toLowerCase();
  if (!message.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 });

  // Find first matching keyword group
  let match = null;
  for (const group of KEYWORDS) {
    if (group.keys.some((k) => message.includes(k.toLowerCase()))) {
      match = group;
      break;
    }
  }
  if (!match) match = { keys: [], ruleIds: [], setIds: [], reply: DEFAULT_REPLY };

  // Resolve recommended rule ids against actual catalog
  const catalog = await loadCatalog();
  const byId = new Map(catalog.map((r) => [r.id, r]));
  const recommendations = match.ruleIds.map((id) => byId.get(id)).filter(Boolean) as RuleDoc[];

  // Resolve recommended set ids against RULE_SETS catalog
  const setById = new Map(RULE_SETS.map((s) => [s.id, s]));
  const recommendedSets = match.setIds.map((id) => setById.get(id)).filter(Boolean) as RuleSet[];

  return NextResponse.json({
    reply: match.reply,
    recommendations,
    recommendedSets,
    matches: match.keys,
  });
}