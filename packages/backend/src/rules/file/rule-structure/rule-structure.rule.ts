// spec:[ReviewRule Contract](/docs/710-code-review-rules.md)
import fs from 'fs';
import ts from 'typescript';
import path from 'path';
import type { ReviewIssue, RuleContext } from '@checkit/shared';
import { windowSafeJoin, tryReadFile } from '../../_shared/utils';

/**
 * rule-structure 规则
 *
 * 强制每个 rule 满足 ReviewRule 契约:
 * - class 显式 `implements ReviewRule`
 * - 有 `check(context: RuleContext)` 方法
 * - 有 `fix(issue: ReviewIssue): boolean` 方法
 * - 静态 id 与实例 id 一致
 *
 * 原因:checkit 是"知识法律 runtime",每个 rule 是"法律条文"。
 * 没有 fix() 的 rule = 没有"执法机制"——只能报警,不能修。
 * 这违反了 checkit 5 步闭环(detect → explain → fix → verify → learn)。
 *
 * 触发:error(违反契约 = 规则不可用)
 */
const RuleStructureRule = class RuleStructureRule {
  static id = 'rule-structure';
  id = RuleStructureRule.id;
  glob = '**/*.rule.ts';

  constructor(_: unknown) {}

  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    for (const file of context.files) {
      if (!file.endsWith('.rule.ts')) continue;
      if (file.includes('/test/') || file.includes('\\test\\')) continue;

      const filePath = windowSafeJoin(context.targetPath, file);
      if (!fs.existsSync(filePath)) continue;

      const content = tryReadFile(filePath);
      if (!content) continue;

      const problems = analyzeRuleFile(filePath, content);
      for (const problem of problems) {
        issues.push({
          type: 'structure',
          module: path.basename(file, '.rule.ts'),
          file,
          line: problem.line,
          issue: problem.message,
          expect: problem.expect,
          level: 'error',
          fixable: false,
        });
      }
    }

    return issues;
  }
};

interface Problem {
  line: number;
  message: string;
  expect: string;
}

function analyzeRuleFile(filePath: string, content: string): Problem[] {
  const problems: Problem[] = [];

  // 1. 检查文件里至少 1 个 class
  // 2. 检查 class implements ReviewRule
  // 3. 检查 check 方法
  // 4. 检查 fix 方法

  const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  let classCount = 0;
  let hasImplementsReviewRule = false;
  let hasCheckMethod = false;
  let hasFixMethod = false;

  function visit(node: ts.Node) {
    // 支持 const X: ReviewRule = class X {} 这种类型注解
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (decl.type && decl.initializer && ts.isClassExpression(decl.initializer)) {
          const typeText = decl.type.getText(sf);
          if (typeText === 'ReviewRule') {
            hasImplementsReviewRule = true;
          }
        }
      }
    }

    // 支持 class declaration 和 class expression(OkfComplianceRule 用 const X = class {})
    const isClass = ts.isClassDeclaration(node) || ts.isClassExpression(node);
    if (isClass && (node as ts.ClassDeclaration | ts.ClassExpression).name) {
      classCount++;
      const cls = node as ts.ClassDeclaration | ts.ClassExpression;
      const heritageClauses = cls.heritageClauses || [];
      for (const clause of heritageClauses) {
        if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
          for (const t of clause.types) {
            const name = t.getText(sf);
            if (name === 'ReviewRule') {
              hasImplementsReviewRule = true;
            }
          }
        }
      }
      for (const member of cls.members) {
        if (ts.isMethodDeclaration(member) && member.name) {
          const methodName = member.name.getText(sf);
          if (methodName === 'check') hasCheckMethod = true;
          if (methodName === 'fix') hasFixMethod = true;
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);

  if (classCount === 0) {
    problems.push({
      line: 1,
      message: 'No class declaration found in rule file',
      expect: 'Export a class implementing ReviewRule, e.g., `export class XRule implements ReviewRule { ... }`',
    });
  } else {
    if (!hasImplementsReviewRule) {
      problems.push({
        line: 1,
        message: 'Class does not explicitly `implements ReviewRule` — violates checkit rule contract',
        expect: 'Add `implements ReviewRule` after class name, e.g., `class XRule implements ReviewRule { ... }`',
      });
    }
    if (!hasCheckMethod) {
      problems.push({
        line: 1,
        message: 'Missing `check(context: RuleContext): ReviewIssue[]` method',
        expect: 'Add `check(context: RuleContext): ReviewIssue[] { ... }` method',
      });
    }
    if (!hasFixMethod) {
      problems.push({
        line: 1,
        message: 'Missing `fix(issue: ReviewIssue): boolean` method — every checkit rule must support auto-fix to fulfill the detect→fix→verify→learn loop',
        expect: 'Add `fix(issue: ReviewIssue): boolean { ... }` method (return true if fix applied, false if not fixable)',
      });
    }
  }

  return problems;
}

export default RuleStructureRule;
export { RuleStructureRule };
