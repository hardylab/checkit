// spec:[spec](specs/backend/rules/no-any-rule.md)
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import type { ReviewIssue, RuleContext } from '@checkit/shared';

/**
 * V4 重写版 no-any-rule
 *
 * 检测 TypeScript 源码中的 `any` 类型。
 *
 * 改进(VS V3 老版):
 * - 不依赖任何"特殊跳过逻辑"——直接用 TS AST 找 AnyKeyword 节点
 * - 跳过字符串 / 注释 / `as any` 断言
 * - 用 `useState<any>()` 也要报告(泛型里的 any 也是 any)
 *
 * 用法:跟 V3 rule 一样,被 runAdaptedRule 走 V4 adapter。
 */
export function checkNoAny(file: string, content: string, filePath: string, moduleName: string): ReviewIssue[] {
  const issues: ReviewIssue[] = [];

  // 快速 grep 兜底:无 any 直接返回
  if (!/\bany\b/.test(content)) return issues;

  const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const lines = content.split(/\r?\n/);

  /**
   * 递归走所有 node + token(AnyKeyword 是 token,forEachChild 不会进)
   * 用 getChildren() 拿所有 child(包括 token)
   */
  const visit = (node: ts.Node) => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      // 跳过:在 `as any(...)` 模式 —— 这是类型断言必须写
      const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      const lineIdx = pos.line;
      const line = lines[lineIdx] || '';
      const col = pos.character;

      // 跳过:在 `as any` 类型断言 —— 这是必要模式(external API 强转)
      // 必须前面有 `as` 关键字,后面是标识符 / 字面量 / 对象 / 数组 / 终结符
      const before = line.slice(0, col).trimEnd();
      const after = line.slice(col + 3).trimStart();
      const beforeWord = before.split(/\s+/).pop() || '';
      // `xxx as any` / `xxx as any,` / `xxx as any)` / `xxx as any;` / `xxx as any\n` 都算类型断言
      const isTypeAssertion =
        beforeWord === 'as' &&
        (/^[,;)\]}/]/.test(after) ||
          /^[\w'"`({]/.test(after) ||
          after === '');

      if (!isTypeAssertion) {
        issues.push({
          type: 'type-safety',
          module: moduleName,
          file,
          line: lineIdx + 1,
          issue: "Avoid using 'any' type — use 'unknown' + type guard or specific type instead",
          expect:
            "Replace `any` with `unknown`, a specific interface, or a generic parameter.",
          level: 'warning',
          fixable: false,
          data: { filePath, lineNumber: lineIdx + 1 },
        });
      }
      return; // token 没 children
    }
    // getChildren() 包含所有 child node 和 token
    node.getChildren(sf).forEach(visit);
  };
  visit(sf);

  return issues;
}

// 默认导出类,被 V3/V4 adapter 包装
export class NoAnyRule {
  static id = 'no-any-rule';
  id = NoAnyRule.id;

  constructor(_: unknown) {}

  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    for (const file of context.files) {
      if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
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

      issues.push(...checkNoAny(file, content, filePath, moduleName));
    }
    return issues;
  }
}

export default NoAnyRule;
