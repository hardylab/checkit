// spec:[spec](specs/backend/rules/require-tsconfig-one-way-references.md#L1)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'require-tsconfig-one-way-references': {};
  }
}

export class RequireTsconfigOneWayReferencesRule implements ReviewRule {
  static id = 'require-tsconfig-one-way-references';
  id = RequireTsconfigOneWayReferencesRule.id;
  constructor(_: {}) {}
  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const tsconfigFiles = context.files.filter((f) => {
      const base = path.basename(f).toLowerCase();
      return base.startsWith('tsconfig') && (base.endsWith('.json') || base.endsWith('.jsonc'));
    });
    const edges = new Map<string, Set<string>>();
    const fileByDir = new Map<string, string>();
    for (const rel of tsconfigFiles) {
      const abs = path.join(context.targetPath, rel);
      if (!fs.existsSync(abs)) continue;
      const dir = path.normalize(path.dirname(rel));
      fileByDir.set(dir, rel);
      const raw = fs.readFileSync(abs, 'utf-8');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: any;
      try {
        parsed = JSON.parse(stripJsonComments(raw));
      } catch {
        issues.push({
          type: 'structure',
          module: context.targetName,
          file: rel,
          issue: `无法解析 "${rel}"，请使用有效的 JSON/JSONC 格式并正确配置 references`,
          expect:
            '修复 tsconfig JSON/JSONC 语法并确保 references 字段为有效数组，指向目标包目录或 tsconfig 文件。',
          level: 'error',
          fixable: false,
        });
        continue;
      }
      const refs: Array<{ path: string }> = Array.isArray(parsed?.references)
        ? parsed.references
        : [];
      if (!edges.has(dir)) edges.set(dir, new Set());
      for (const ref of refs) {
        const fromAbsDir = path.join(context.targetPath, dir);
        const refAbs = path.resolve(fromAbsDir, ref.path);
        let refRel = path.relative(context.targetPath, refAbs);
        if (!refRel) continue;
        refRel = path.normalize(refRel);
        const isFile =
          refRel.toLowerCase().endsWith('.json') || refRel.toLowerCase().endsWith('.jsonc');
        const refDir = isFile ? path.normalize(path.dirname(refRel)) : refRel;
        if (!edges.has(dir)) edges.set(dir, new Set());
        edges.get(dir)!.add(refDir);
      }
    }
    const cycles = detectCycles(edges);
    for (const cycle of cycles) {
      const chainText = cycle.join(' -> ') + ' -> ' + cycle[0];
      const anchor = fileByDir.get(cycle[0]) || fileByDir.values().next().value || undefined;
      issues.push({
        type: 'architecture',
        module: context.targetName,
        file: anchor,
        issue: `monorepo 项目引用必须单向，检测到循环依赖：${chainText}`,
        expect: '调整 tsconfig references 的指向，确保仅从上层指向下层；拆分或重组引用以消除环路。',
        level: 'error',
        fixable: false,
        data: { chain: cycle },
      });
    }
    return issues;
  }
}

function stripJsonComments(input: string): string {
  let s = input.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/(^|\s)\/\/.*$/gm, '');
  return s;
}

function detectCycles(graph: Map<string, Set<string>>): string[][] {
  const cycles: string[][] = [];
  const state = new Map<string, number>();
  const stack: string[] = [];
  const nodes = Array.from(graph.keys());
  const onStack = new Set<string>();
  const pushCycle = (cycle: string[]) => {
    const key = cycle.join('->');
    if (!cycles.some((c) => c.join('->') === key)) cycles.push([...cycle]);
  };
  const dfs = (u: string) => {
    state.set(u, 1);
    stack.push(u);
    onStack.add(u);
    for (const v of graph.get(u) || []) {
      if (!state.has(v)) {
        dfs(v);
      } else if (onStack.has(v)) {
        const idx = stack.indexOf(v);
        if (idx !== -1) pushCycle(stack.slice(idx));
      }
    }
    onStack.delete(u);
    stack.pop();
    state.set(u, 2);
  };
  for (const n of nodes) {
    if (!state.has(n)) dfs(n);
  }
  return cycles;
}
