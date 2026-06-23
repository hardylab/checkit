// Shared report logic — used by both the dashboard and AI-fix pages.

export type Issue = {
  type: string;
  module: string;
  file?: string | null;
  line?: number | null;
  issue: string;
  expect?: string;
  level: 'error' | 'warning' | 'info';
  fixable?: boolean;
  data?: Record<string, any>;
};

export type Report = {
  issues: Issue[];
  source: string;             // filename or cwd
  raw?: any;                  // raw payload for back-reference
};

export const CATEGORIES = {
  all:          '全部问题',
  security:     '安全隐患',
  architecture: '架构与规范',
  quality:      '代码质量',
  spec:         '规范追踪',
  test:         '测试覆盖',
  repo:         '仓库卫生',
  other:        '其他',
} as const;

export type CategoryKey = keyof typeof CATEGORIES;

export function normalizeReport(raw: any, source: string): Report {
  const issues = Array.isArray(raw) ? raw : (raw?.issues ?? []);
  return { issues, source, raw };
}

export function computeHealth(issues: Issue[]): number {
  if (!issues.length) return 100;
  let penalty = 0;
  for (const i of issues) {
    if (i.level === 'error') penalty += 8;
    else if (i.level === 'warning') penalty += 3;
    else if (i.level === 'info') penalty += 1;
  }
  return Math.max(0, 100 - penalty);
}

export function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) {
    const k = keyFn(item);
    const arr = out.get(k) ?? [];
    arr.push(item);
    out.set(k, arr);
  }
  return out;
}

export function categorizeIssue(issue: Issue): CategoryKey {
  const id = (issue.module || issue.type || '').toLowerCase();
  if (id.includes('secret') || id.includes('aws') || id.includes('credential') || id.includes('plaintext')) return 'security';
  if (id.includes('no-any') || id.includes('no-console') || id.includes('no-magic') || id.includes('function-size') || id.includes('many-conditions')) return 'quality';
  if (id.includes('spec') || id.includes('traceability')) return 'spec';
  if (id.includes('test')) return 'test';
  if (id.includes('flow') || id.includes('architecture')) return 'architecture';
  if (id.includes('git') || id.includes('ignore') || id.includes('utf8')) return 'repo';
  return 'other';
}