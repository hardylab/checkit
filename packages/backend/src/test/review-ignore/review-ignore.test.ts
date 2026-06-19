import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReviewRule, RuleContext, ReviewIssue } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

vi.mock('fs');
vi.mock('path');

class MockRule implements ReviewRule {
  id: string;
  ignorable?: boolean;
  constructor(id: string, ignorable?: boolean) {
    this.id = id;
    this.ignorable = ignorable;
  }
  check(_: RuleContext): ReviewIssue[] {
    return [
      {
        type: 'structure',
        module: 'proj',
        file: 'a.ts',
        issue: 'mock issue',
        level: 'warning',
        fixable: false,
      },
    ];
  }
}

function runWithIgnore(rules: ReviewRule[], ctx: RuleContext): ReviewIssue[] {
  const all: ReviewIssue[] = [];
  const ignoreMap: Record<string, string[]> = {};
  for (const rel of ctx.files) {
    const abs = path.join(ctx.targetPath, rel);
    if (!fs.existsSync(abs)) continue;
    const content = fs.readFileSync(abs, 'utf-8');
    const first = content.split(/\r?\n/).slice(0, 5).join('\n') || '';
    const m = first.match(/review-ignore:\s*([^\n]+)/i);
    if (m) {
      ignoreMap[rel] = m[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  const illegal = new Set<string>();
  for (const r of rules) {
    const issues = r.check(ctx);
    for (const i of issues) {
      const ids = i.file ? ignoreMap[i.file] : undefined;
      if (ids?.includes(r.id)) {
        if (r.ignorable) {
          continue;
        } else {
          const k = `${i.file}::${r.id}`;
          if (!illegal.has(k)) {
            illegal.add(k);
            all.push({
              type: 'structure',
              module: ctx.targetName,
              file: i.file,
              issue: `该文件声明 review-ignore 以忽略规则 '${r.id}'，但该规则不可忽略（ignorable=false）`,
              level: 'error',
              fixable: false,
            });
          }
          all.push(i);
        }
      } else {
        all.push(i);
      }
    }
  }
  return all;
}

describe('review-ignore mechanism', () => {
  const ctx: RuleContext = {
    cwd: '/cwd',
    projectRoot: '/root',
    targetPath: '/root/target',
    targetName: 'proj',
    targetType: 'project',
    files: ['a.ts'],
    autoFix: false,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(path, 'join').mockImplementation((...parts: string[]) => parts.join('/'));
  });

  it('ignores issues when rule is ignorable', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue('// review-ignore: ignorable-rule\nconst x=1;');
    const out = runWithIgnore([new MockRule('ignorable-rule', true)], ctx);
    expect(out).toHaveLength(0);
  });

  it('reports error when rule is not ignorable', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue('// review-ignore: strict-rule\nconst x=1;');
    const out = runWithIgnore([new MockRule('strict-rule', false)], ctx);
    expect(out.some((i) => i.level === 'error' && (i.issue || '').includes('不可忽略'))).toBe(true);
  });
});
