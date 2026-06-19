// spec:[spec](specs/backend/rules/many-conditions-rule.md#L1)
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

export interface ManyConditionsOptions {
  maxBranches?: number;
}

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'many-conditions-rule': ManyConditionsOptions;
  }
}

export class ManyConditionsRule implements ReviewRule {
  static id = 'many-conditions-rule';
  id = ManyConditionsRule.id;
  ignorable = true;
  private options?: ManyConditionsOptions;
  constructor(options?: ManyConditionsOptions) {
    this.options = options;
  }

  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const maxBranches = this.options?.maxBranches ?? 6;
    const files = context.files.filter(
      (f) => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx')
    );

    for (const rel of files) {
      const abs = path.join(context.targetPath, rel);
      if (!fs.existsSync(abs)) continue;
      const content = fs.readFileSync(abs, 'utf-8');

      // Fast pre-check: detect sequences of "if" / "else if" or "case"
      const lines = content.split(/\r?\n/);
      let consecutiveIf = 0;
      let maxConsecutiveIf = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        if (/^if\s*\(|^else\s+if\s*\(/.test(trimmed)) {
          consecutiveIf += 1;
          if (consecutiveIf > maxConsecutiveIf) maxConsecutiveIf = consecutiveIf;
        } else if (/^else\b/.test(trimmed)) {
          // allow chain continuation
          continue;
        } else {
          consecutiveIf = 0;
        }
      }
      const caseCountFast = (content.match(/^\s*case\s+/gm) || []).length;
      const triggerFast = maxConsecutiveIf >= maxBranches || caseCountFast >= maxBranches;
      if (!triggerFast) continue;

      // AST confirmation
      const sf = ts.createSourceFile(abs, content, ts.ScriptTarget.Latest, true);
      const getIfChainLen = (node: ts.IfStatement): number => {
        let count = 1;
        let cur: ts.IfStatement | undefined = node;
        while (cur && cur.elseStatement && ts.isIfStatement(cur.elseStatement)) {
          count += 1;
          cur = cur.elseStatement;
        }
        return count;
      };
      const collect = (
        node: ts.Node,
        reportIf: (pos: number, branches: number) => void,
        reportSwitch: (pos: number, branches: number) => void
      ): void => {
        if (ts.isIfStatement(node)) {
          const len = getIfChainLen(node);
          if (len >= maxBranches) {
            reportIf(node.getStart(sf), len);
          }
        }
        if (ts.isSwitchStatement(node)) {
          const cases = node.caseBlock.clauses.filter((c) => ts.isCaseClause(c)).length;
          if (cases >= maxBranches) {
            reportSwitch(node.getStart(sf), cases);
          }
        }
        ts.forEachChild(node, (n) => collect(n, reportIf, reportSwitch));
      };

      let foundAny = false;
      collect(
        sf,
        (pos, branches) => {
          foundAny = true;
          const lc = sf.getLineAndCharacterOfPosition(pos);
          issues.push({
            type: 'architecture',
            module: context.targetName,
            file: rel,
            line: lc.line + 1,
            issue: `if-else 链分支过多（${branches}），超过阈值 ${maxBranches}`,
            expect: [
              '重构为策略模式或函数映射（表驱动）：',
              'interface Strategy { handle(x: any): any }',
              'const strategies: Record<string, Strategy> = { a: new A(), b: new B() }',
              'return (strategies[key] ?? defaultStrategy).handle(input)',
              '或使用函数表：',
              'const handlers: Record<string, (x: any) => any> = { a: hA, b: hB }',
              'return (handlers[key] ?? default)(input)',
              '复杂链可改为职责链：',
              'abstract class Handler { setNext(h: Handler): Handler; handle(req: any): any }',
              'const h = h1.setNext(h2).setNext(h3); return h.handle(req)',
            ].join('\n'),
            level: 'warning',
            fixable: false,
          });
        },
        (pos, branches) => {
          foundAny = true;
          const lc = sf.getLineAndCharacterOfPosition(pos);
          issues.push({
            type: 'architecture',
            module: context.targetName,
            file: rel,
            line: lc.line + 1,
            issue: `switch-case 分支过多（${branches}），超过阈值 ${maxBranches}`,
            expect: [
              '重构为表驱动或命令/策略模式：',
              'const cases: Record<number, () => any> = { 1: () => do1(), 2: () => do2() }',
              'return (cases[key] ?? default)()',
              '若分支具备状态转换，采用状态模式：',
              'interface State { run(ctx: any): any }',
              'const states: Record<string, State> = { s1: new S1(), s2: new S2() }',
              'return (states[current] ?? defaultState).run(ctx)',
            ].join('\n'),
            level: 'warning',
            fixable: false,
          });
        }
      );
      if (!foundAny) {
        // If fast check triggered but AST didn't, skip
        continue;
      }
    }

    return issues;
  }
}
