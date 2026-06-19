// spec:[spec](specs/backend/rules/many-conditions-rule.md)
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import type { ReviewIssue, RuleContext } from '@checkit/shared';

export interface ManyConditionsOptions {
  maxBranches?: number;
}

/**
 * V4 重写版 many-conditions-rule
 *
 * 检测 if-else 链 / switch case 过多(默认 6 个分支)
 *
 * 改进(VS V3 老版):
 * - issue 消息改成英文(V4 国际化)
 * - 错误信息更具体(if-else 链 vs switch)
 * - 保持 AST 检测逻辑(if-else 链 + switch case)
 */
export function checkManyConditions(
  file: string,
  content: string,
  filePath: string,
  moduleName: string,
  maxBranches: number
): ReviewIssue[] {
  const issues: ReviewIssue[] = [];

  // Fast pre-check
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
  if (maxConsecutiveIf < maxBranches && caseCountFast < maxBranches) {
    return issues; // no trigger
  }

  // AST confirmation
  const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  const getIfChainLen = (node: ts.IfStatement): number => {
    let count = 1;
    let cur: ts.IfStatement | undefined = node;
    while (cur && cur.elseStatement && ts.isIfStatement(cur.elseStatement)) {
      count += 1;
      cur = cur.elseStatement;
    }
    return count;
  };

  const collect = (node: ts.Node): void => {
    if (ts.isIfStatement(node)) {
      const len = getIfChainLen(node);
      if (len >= maxBranches) {
        const lc = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        issues.push({
          type: 'architecture',
          module: moduleName,
          file,
          line: lc.line + 1,
          issue: `if-else chain too long: ${len} branches (max ${maxBranches})`,
          expect:
            'Refactor into a lookup table, polymorphism, or extract sub-conditions into helper functions.',
          level: 'warning',
          fixable: false,
          data: { filePath, lineNumber: lc.line + 1, branches: len, kind: 'if-else' },
        });
      }
    }
    if (ts.isSwitchStatement(node)) {
      const cases = node.caseBlock.clauses.filter((c) => ts.isCaseClause(c)).length;
      if (cases >= maxBranches) {
        const lc = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        issues.push({
          type: 'architecture',
          module: moduleName,
          file,
          line: lc.line + 1,
          issue: `switch statement too long: ${cases} cases (max ${maxBranches})`,
          expect:
            'Refactor into a lookup table or polymorphism. Switch with many cases often indicates missing polymorphism.',
          level: 'warning',
          fixable: false,
          data: { filePath, lineNumber: lc.line + 1, branches: cases, kind: 'switch' },
        });
      }
    }
    ts.forEachChild(node, collect);
  };
  collect(sf);

  return issues;
}

export class ManyConditionsRule {
  static id = 'many-conditions-rule';
  id = ManyConditionsRule.id;
  ignorable = true;
  private options: ManyConditionsOptions;

  constructor(options: ManyConditionsOptions = {}) {
    this.options = options;
  }

  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const maxBranches = this.options.maxBranches ?? 6;

    for (const file of context.files) {
      if (
        !file.endsWith('.ts') &&
        !file.endsWith('.tsx') &&
        !file.endsWith('.js') &&
        !file.endsWith('.jsx')
      ) continue;
      if (/\.test\.(ts|tsx)$/.test(file)) continue;
      if (/\.spec\.(ts|tsx)$/.test(file)) continue;

      // Windows 路径安全拼接
      const sep = context.targetPath.includes('\\') ? '\\' : '/';
      const filePath =
        context.targetPath.replace(/[\\/]+$/, '') + sep + file.replace(/^[\\/]+/, '');
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const moduleName = filePath
        .replace(/\\/g, '/')
        .split('/')
        .filter(Boolean)
        .slice(-2, -1)[0] || 'unknown';

      issues.push(...checkManyConditions(file, content, filePath, moduleName, maxBranches));
    }
    return issues;
  }
}

export default ManyConditionsRule;
