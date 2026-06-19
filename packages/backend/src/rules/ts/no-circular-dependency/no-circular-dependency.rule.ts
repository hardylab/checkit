// spec:[spec](specs/backend/rules/no-circular-dependency.md#L1)
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'no-circular-dependency': {};
  }
}

function parseImports(content: string): string[] {
  const res: string[] = [];
  const patterns = [
    /import\s+[^'"]*['"]([^'"]+)['"]/g,
    /export\s+[^'"]*from\s+['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(content)) !== null) {
      res.push(m[1]);
    }
  }
  return res;
}

export class NoCircularDependencyRule implements ReviewRule {
  static id = 'no-circular-dependency';
  id = NoCircularDependencyRule.id;
  constructor(_: {}) {}
  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const files = context.files.filter(
      (f) => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx')
    );
    const normalizeLike = (p: string) => p.replace(/\\+/g, '/').replace(/\/\.\//g, '/');
    const absMap = new Map<string, string>();
    const importsMap = new Map<string, string[]>();
    for (const f of files) {
      const fp = path.join(context.targetPath, f);
      const fpNorm = path.normalize(fp);
      if (!fs.existsSync(fp)) continue;
      const content = fs.readFileSync(fp, 'utf-8');
      const imps = parseImports(content).flatMap((p) => {
        if (p.startsWith('.')) {
          const base = normalizeLike(path.join(path.dirname(fp), p));
          return [
            base,
            `${base}.ts`,
            `${base}.tsx`,
            normalizeLike(path.join(base, 'index.ts')),
            normalizeLike(path.join(base, 'index.tsx')),
          ];
        }
        return [p];
      });
      absMap.set(fpNorm, f);
      importsMap.set(fpNorm, imps);
    }
    const visited = new Set<string>();
    const stack = new Set<string>();
    const keys = new Set(Array.from(importsMap.keys()).map((k) => k.replace(/\\+/g, '/')));
    function dfs(n: string): string[] | null {
      if (stack.has(n)) return [n];
      if (visited.has(n)) return null;
      visited.add(n);
      stack.add(n);
      const imps = importsMap.get(n) || [];
      for (const m of imps) {
        const candidates = [
          m,
          `${m}.ts`,
          `${m}.tsx`,
          normalizeLike(path.join(m, 'index.ts')),
          normalizeLike(path.join(m, 'index.tsx')),
        ].map((c) => normalizeLike(c));
        const resolved = candidates.find((c) => keys.has(c));
        if (!resolved) continue;
        const cyc = dfs(resolved);
        if (cyc) {
          cyc.push(n);
          return cyc;
        }
      }
      stack.delete(n);
      return null;
    }
    for (const fp of importsMap.keys()) {
      stack.clear();
      const cyc = dfs(fp);
      if (cyc && cyc.length > 1) {
        const chain = cyc
          .map((x) => absMap.get(x) || x)
          .reverse()
          .join(' -> ');
        issues.push({
          type: 'architecture',
          module: context.targetName,
          issue: `Circular dependency: ${chain}`,
          expect:
            '通过拆分公共依赖、引入中间层或调整模块依赖方向来打断循环依赖链；避免 A↔B 互相引用。',
          level: 'error',
          fixable: false,
        });
      }
    }
    return issues;
  }
}
