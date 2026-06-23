// apps/desktop/app/lib/rule-sets.ts — bundled rule groups (like ESLint presets).
//
// A rule set is a curated package of related rules that solve one
// concrete problem. Installing a set enables every rule it contains.
// This mirrors the pattern used by ESLint presets, SonarQube quality
// profiles, and the prototype's "OWASP Top 10 / React 19" cards.
//
// Source model:
//   - official  → authored by the checkit team
//   - community → vetted community contribution
//   - team      → internal team convention (not for distribution)

export type RuleSetSource = 'official' | 'community' | 'team';

export type RuleSetCategory =
  | 'security'
  | 'quality'
  | 'architecture'
  | 'file'
  | 'testing'
  | 'config'
  | 'documentation';

export type RuleSet = {
  id: string;
  name: string;
  category: RuleSetCategory;
  description: string;
  icon: string;          // 2-char initials shown in the card icon
  ruleIds: string[];     // references into /api/rules
  source: RuleSetSource;
  featured?: boolean;
  installs: number;
  rating: number;        // 0-5
  updatedDays: number;   // days since last update
};

export const RULE_SETS: RuleSet[] = [
  {
    id: 'security-baseline',
    name: '安全基线',
    category: 'security',
    description: '覆盖最常见的几个安全漏洞:硬编码凭证、git 历史泄漏、敏感文件泄漏、超大二进制文件。适用于所有项目。',
    icon: '盾',
    ruleIds: ['plaintext-credentials', 'git-no-secrets-in-history', 'gitignore-sensitive-required', 'git-no-large-files'],
    source: 'official',
    featured: true,
    installs: 12_400,
    rating: 4.9,
    updatedDays: 5,
  },
  {
    id: 'ts-strict',
    name: 'TypeScript 严格增强',
    category: 'quality',
    description: '在 tsconfig strict 之外,进一步约束 any / 魔法数字 / 配置散乱 / 循环依赖。',
    icon: 'TS',
    ruleIds: ['no-any-rule', 'no-magic-numbers', 'require-tsconfig-no-emit', 'require-tsconfig-one-way-references', 'no-circular-dependency'],
    source: 'official',
    featured: true,
    installs: 8_700,
    rating: 4.8,
    updatedDays: 2,
  },
  {
    id: 'module-boundaries',
    name: '模块边界守门',
    category: 'architecture',
    description: 'index.ts 必须是纯 barrel / 显式 re-export / 入口文件必须 thin — 强制模块结构干净。',
    icon: '模',
    ruleIds: ['index-only-exports', 'require-index-export', 'entry-point-no-logic', 'no-circular-dependency'],
    source: 'official',
    installs: 6_300,
    rating: 4.7,
    updatedDays: 12,
  },
  {
    id: 'file-hygiene',
    name: '文件卫生',
    category: 'file',
    description: '.gitignore 必备 / 命名规范 / 缩进 / 编码 / doc 目录结构。团队新人第一天就要装。',
    icon: '文',
    ruleIds: ['git-ignore-required', 'tab-size-two-spaces', 'utf8-encoding-required', 'filename-naming-rule', 'doc-pattern'],
    source: 'official',
    featured: true,
    installs: 9_200,
    rating: 4.8,
    updatedDays: 3,
  },
  {
    id: 'test-coverage',
    name: '测试基线',
    category: 'testing',
    description: '每个有函数的 source 文件必须有对应的 .test.ts,测试必须在 test/ 子目录,代码必须引用 spec 文档。',
    icon: '测',
    ruleIds: ['require-test-file', 'group-test-files', 'spec-traceability-check'],
    source: 'official',
    installs: 3_800,
    rating: 4.5,
    updatedDays: 9,
  },
  {
    id: 'code-cleanup',
    name: '代码整洁',
    category: 'quality',
    description: 'console.log 残留 / 函数超过 N 行 / 圈复杂度过高 — read-and-keep 类自动修复。',
    icon: '整',
    ruleIds: ['no-console-log', 'function-size-limit', 'many-conditions-rule'],
    source: 'community',
    installs: 5_500,
    rating: 4.7,
    updatedDays: 7,
  },
  {
    id: 'config-safety',
    name: '配置安全',
    category: 'config',
    description: 'process.env 必须走 typed config helper,防止 typo 和运行时 undefined。',
    icon: '配',
    ruleIds: ['env-var-check'],
    source: 'community',
    installs: 4_100,
    rating: 4.6,
    updatedDays: 28,
  },
  {
    id: 'docs-quality',
    name: '文档质量',
    category: 'documentation',
    description: '.md 必须带 OKF v0.1 frontmatter,方便 AI agent 和 IDE 解析。',
    icon: '档',
    ruleIds: ['okf-compliance'],
    source: 'community',
    installs: 2_100,
    rating: 4.4,
    updatedDays: 14,
  },
  {
    id: 'flow-style',
    name: '流水线命名',
    category: 'architecture',
    description: 'Pipeline / flow 文件必须按 <verb>.<subject>.ts 命名(例如 parse.invoice.ts)。',
    icon: '流',
    ruleIds: ['flow-naming-rule'],
    source: 'team',
    installs: 0,
    rating: 0,
    updatedDays: 1,
  },
  {
    id: 'freshness',
    name: 'Freshness — 最近修改的文件',
    category: 'quality',
    description: '对最近 N 分钟修改的文件强制 Prettier / lint --fix,防止漏格式提交。',
    icon: '鲜',
    ruleIds: ['recent-files-format', 'recent-files-lint-fix'],
    source: 'community',
    installs: 1_700,
    rating: 4.3,
    updatedDays: 21,
  },
];

export const CATEGORY_LABEL: Record<RuleSetCategory, string> = {
  security: '安全合规',
  quality: '代码质量',
  architecture: '架构 / 规范',
  file: '文件 / Git',
  testing: '测试覆盖',
  config: '依赖卫生',
  documentation: '文档质量',
};

// Helper: does a set's rule list intersect the user's enabled rules?
export function isSetInstalled(set: RuleSet, installedIds: Set<string>): boolean {
  return set.ruleIds.every((id) => installedIds.has(id));
}

export function fmtInstalls(n: number): string {
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return String(n);
}

export function freshnessLabel(days: number): string {
  if (days <= 0) return '今日更新';
  if (days === 1) return '昨天更新';
  if (days < 7) return `${days} 天前更新`;
  if (days < 30) return `${Math.floor(days / 7)} 周前更新`;
  return `${Math.floor(days / 30)} 个月前更新`;
}