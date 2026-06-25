// packages/backend/src/chat/keyword-adapter.ts — Local keyword-based chat
//
// 用途:CLI standalone 的 AI 对话。无 LLM,纯关键词字典 + 规则元数据模糊匹配。
// 这是 MSP C1 的 LocalKeywordAdapter 实现(默认 adapter,无需 API key)。
//
// 设计原则:
// - 不引入新依赖,纯 fs + path + rule registry
// - 关键词字典静态写在文件里,跟着规则一起更新
// - 输出结构稳定,跟未来 OpenAI/Claude adapter 同一 shape,方便上层替换

import fs from 'node:fs';
import path from 'node:path';
import { ruleClasses } from '../rules/registry.js';

/** Shape returned to `lintany chat` and `/api/chat`. */
export interface ChatReply {
  reply: string;
  suggestions: Array<{ id: string; title: string; tldr?: string }>;
  recommendedSets: Array<{ id: string; name: string; description: string }>;
}

/**
 * Static keyword → rule-id dictionary.
 * 长尾 keyword 不命中时,fallback 到规则元数据模糊匹配。
 *
 * 编辑规则:每条 [keyword, [rule-id, ...]] 严格映射。
 */
const KEYWORD_RULES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['credential', ['plaintext-credentials', 'git-no-secrets-in-history']],
  ['secret', ['plaintext-credentials', 'git-no-secrets-in-history']],
  ['password', ['plaintext-credentials']],
  ['api key', ['plaintext-credentials']],
  ['gitignore', ['gitignore-sensitive-required', 'git-ignore-required']],
  ['console.log', ['no-console-log']],
  ['log', ['no-console-log']],
  ['any', ['no-any-rule']],
  ['typescript', ['no-any-rule', 'ts-strict-bundle']],
  ['ts strict', ['no-any-rule', 'ts-strict-bundle']],
  ['strict mode', ['no-any-rule', 'ts-strict-bundle']],
  ['magic number', ['no-magic-numbers']],
  ['circular', ['no-circular-dependency']],
  ['test', ['require-test-file', 'group-test-files']],
  ['spec', ['use-spec-coding']],
  ['coding', ['use-spec-coding']],
  ['doc', ['doc-pattern']],
  ['filename', ['filename-naming-rule']],
  ['naming', ['filename-naming-rule']],
  ['large file', ['git-no-large-files']],
  ['binary', ['git-no-large-files']],
  ['utf8', ['utf8-encoding-required']],
  ['encoding', ['utf8-encoding-required']],
  ['tab', ['tab-size-two-spaces']],
  ['indent', ['tab-size-two-spaces']],
  ['eslint', ['okf-compliance']],
  ['prettier', ['okf-compliance']],
  ['sql', ['plaintext-credentials']],
  ['injection', ['plaintext-credentials']],
  ['env', ['env-var-check']],
  ['environment variable', ['env-var-check']],
  ['function size', ['function-size-limit']],
  ['complex', ['many-conditions-rule']],
  ['branch', ['many-conditions-rule']],
  ['index', ['index-only-exports', 'require-index-export']],
  ['export', ['index-only-exports', 'require-index-export']],
  ['recent file', ['recent-files-format', 'recent-files-lint-fix']],
  ['tsconfig', ['require-tsconfig-no-emit', 'require-tsconfig-one-way-references']],
  ['module ref', ['require-tsconfig-one-way-references']],
  ['trace', ['spec-traceability-check']],
  ['requirement', ['spec-traceability-check']],
  ['flow', ['flow-naming-rule']],
  ['controller', ['spec-traceability-check']],
  ['service', ['spec-traceability-check']],
  ['entry', ['entry-point-no-logic']],
  ['main', ['entry-point-no-logic']],
  ['structure', ['rule-structure']],
  ['self', ['rule-structure', 'rule-self-check']],
];

/**
 * Bundled rule-set catalog (per desktop apps/desktop/app/lib/rule-sets.ts).
 * CLI 端独立维护一份(避免跨包依赖),后续可提到 shared package。
 */
const BUNDLED_SETS: ReadonlyArray<{ id: string; name: string; description: string; keywords: readonly string[] }> = [
  {
    id: 'security-baseline',
    name: '安全基线',
    description: '覆盖最常见的几个安全漏洞:硬编码凭证、git 历史泄漏、敏感文件泄漏、超大二进制文件。适用于所有项目。',
    keywords: ['credential', 'secret', 'security', 'safe', 'password', 'leak'],
  },
  {
    id: 'ts-strict',
    name: 'TypeScript 严格',
    description: 'TypeScript strict-mode 全套:禁 any / 禁 console.log / 禁 magic number / 模块互引检查 / tsconfig 强约束。',
    keywords: ['typescript', 'ts', 'strict', 'type', 'any'],
  },
  {
    id: 'module-boundaries',
    name: '模块边界',
    description: '强制模块互引方向、index-only exports、entry-point 无逻辑。架构级别的依赖管控。',
    keywords: ['module', 'boundary', 'import', 'export', 'architecture'],
  },
  {
    id: 'file-hygiene',
    name: '文件卫生',
    description: 'filename naming / utf-8 编码 / tab size / doc pattern / 禁大文件。保证 repo 一致性。',
    keywords: ['file', 'naming', 'encoding', 'tab', 'hygiene'],
  },
  {
    id: 'test-coverage',
    name: '测试覆盖',
    description: '强制 test 文件 + group 测试 + coding spec 关联。',
    keywords: ['test', 'coverage', 'spec', 'coding'],
  },
  {
    id: 'code-cleanup',
    name: '代码清理',
    description: 'function size / 复杂条件 / magic number / tsconfig 约束 / 禁 console.log。',
    keywords: ['cleanup', 'complex', 'magic', 'function size'],
  },
  {
    id: 'config-safety',
    name: '配置安全',
    description: 'env var 检查 + .gitignore 强制 + OKF compliance。',
    keywords: ['env', 'config', 'gitignore', 'eslint', 'prettier'],
  },
  {
    id: 'docs-quality',
    name: '文档质量',
    description: '强制 doc 文件存在 + filename naming 关联。',
    keywords: ['doc', 'documentation', 'docs'],
  },
  {
    id: 'flow-style',
    name: '流程风格',
    description: 'flow 命名 / entry-point 约束 / 模块流向一致。',
    keywords: ['flow', 'controller', 'service', 'style'],
  },
  {
    id: 'freshness',
    name: '新鲜度',
    description: 'recent file format + recent file lint-fix。最近改动优先审视。',
    keywords: ['fresh', 'recent', 'last', 'modified'],
  },
];

function lower(s: string): string { return s.toLowerCase(); }

function matchKeywordRules(msg: string): string[] {
  const lm = lower(msg);
  const hits = new Set<string>();
  for (const [kw, ids] of KEYWORD_RULES) {
    if (lm.includes(lower(kw))) for (const id of ids) hits.add(id);
  }
  return [...hits];
}

function matchBundledSets(msg: string): Array<{ id: string; name: string; description: string }> {
  const lm = lower(msg);
  const hits: Array<{ id: string; name: string; description: string }> = [];
  for (const s of BUNDLED_SETS) {
    for (const kw of s.keywords) {
      if (lm.includes(lower(kw))) {
        hits.push({ id: s.id, name: s.name, description: s.description });
        break;
      }
    }
  }
  return hits;
}

/**
 * Pull rule metadata from the rule registry (works for any Rule class that
 * exposes `static metadata = { id, title, tldr }`). Falls back to a synthetic
 * entry if the rule isn't registered.
 */
function lookupRuleMeta(id: string): { id: string; title: string; tldr?: string } {
  try {
    const ctor = (ruleClasses as Record<string, { id?: string; title?: string; tldr?: string; metadata?: { id?: string; title?: string; tldr?: string } }>)[id];
    if (ctor) {
      const meta = ctor.metadata;
      if (meta?.id) {
        return {
          id,
          title: meta.title ?? id,
          tldr: meta.tldr,
        };
      }
      // Fallback: synthesize title from class name + use static id
      if (typeof ctor.id === 'string') {
        return { id, title: ctor.title ?? id };
      }
    }
  } catch {
    /* registry not loadable — fall through */
  }
  return { id, title: id };
}

/** Read <monorepo-root>/docs/MSP.md to ground replies (optional context). */
function readMspContext(): string {
  // best-effort: walk up from cwd to find docs/MSP.md
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, 'docs', 'MSP.md');
    if (fs.existsSync(candidate)) {
      try {
        const text = fs.readFileSync(candidate, 'utf-8');
        return text.slice(0, 800); // truncate
      } catch { /* ignore */ }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return '';
}

/** Localized reply templates. The adapter picks the variant whose language
 * best matches the user's message (CJK chars → zh; Latin alphabet → en).
 * Falls back to English when nothing matches.
 */
const REPLY_NO_MATCH = {
  en: (msg: string) =>
    `I matched no rule or preset for "${msg}". Try a broader phrasing like ` +
    `"TypeScript strict" / "credentials" / "gitignore" / "function size" / "test coverage".`,
  zh: (msg: string) =>
    `没有匹配到 "${msg}" 的规则或预设。试更具体的描述,例如 ` +
    `"TypeScript 严格模式" / "硬编码凭证" / ".gitignore 检查" / "函数长度限制" / "测试覆盖率"。`,
};

const REPLY_MATCHED = {
  en: (msg: string, setCount: number, ruleCount: number, ruleIds: string[]) =>
    `Matched ${[setCount > 0 ? `${setCount} preset candidate(s)` : null,
              ruleCount > 0 ? `${ruleCount} specific rule(s)` : null].filter(Boolean).join(' + ')} ` +
    `for "${msg}". Run: lintany preset new <name> --rules ${ruleIds.join(',')}`,
  zh: (msg: string, setCount: number, ruleCount: number, ruleIds: string[]) =>
    `为 "${msg}" 匹配到 ${[setCount > 0 ? `${setCount} 个候选预设` : null,
                            ruleCount > 0 ? `${ruleCount} 条具体规则` : null].filter(Boolean).join(' + ')}。` +
    `运行: lintany preset new <name> --rules ${ruleIds.join(',')}`,
};

const REPLY_EMPTY = {
  en: 'Empty message. Ask me about rules or presets.',
  zh: '消息为空。告诉我你想加强什么(安全 / TypeScript / 测试 / 文档等)。',
};

/** Heuristic language detection: any CJK char → zh, otherwise en.
 * Empty/whitespace input defaults to zh (the desktop UI's primary language).
 */
function detectLang(msg: string): 'en' | 'zh' {
  const trimmed = msg.trim();
  if (!trimmed) return 'zh';
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(trimmed) ? 'zh' : 'en';
}

function makeReply(msg: string, ruleIds: string[], sets: Array<{ id: string; name: string; description: string }>): ChatReply {
  const suggestions = ruleIds.map(lookupRuleMeta);
  const lang = detectLang(msg);
  let reply: string;
  if (suggestions.length === 0 && sets.length === 0) {
    reply = REPLY_NO_MATCH[lang](msg);
  } else {
    reply = REPLY_MATCHED[lang](msg, sets.length, suggestions.length, suggestions.map((s) => s.id));
  }
  return { reply, suggestions, recommendedSets: sets };
}

export interface ChatOptions {
  adapter?: string;          // for future swap; today always "local-keyword"
  context?: 'none' | 'msp';  // inject docs/MSP.md context (default 'none')
}

/**
 * Main entry: take a user message, return reply + suggestions + recommended sets.
 * Mirrors the shape used by desktop /api/chat (so the desktop route can later
 * delegate to this function instead of carrying its own copy).
 */
export async function chatReply(msg: string, _opts: ChatOptions = {}): Promise<ChatReply> {
  const trimmed = msg.trim();
  if (!trimmed) {
    return {
      reply: REPLY_EMPTY[detectLang(msg)],
      suggestions: [],
      recommendedSets: [],
    };
  }

  const ruleHits = matchKeywordRules(trimmed);
  const setHits = matchBundledSets(trimmed);

  const reply = makeReply(trimmed, ruleHits, setHits);

  // Optional MSP context injection (no-op for now; reserved for LLM adapters).
  if (_opts.context === 'msp') {
    const ctx = readMspContext();
    if (ctx) reply.reply += `\n\n[context: ${ctx.length} chars from docs/MSP.md]`;
  }
  return reply;
}
