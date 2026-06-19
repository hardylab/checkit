// spec:[spec](/specs/backend/rules/no-any-rule.md)
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import type { ReviewRule, RuleContext, ReviewIssue } from '@checkit/shared';

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'no-any-rule': {};
  }
}

export class NoAnyRule implements ReviewRule {
  static id = 'no-any-rule';
  id = NoAnyRule.id;
  constructor(_: {}) {}
  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    for (const file of context.files) {
      if (/(^|[\\/])test([\\/]|$)/.test(file)) continue;
      if (!file.endsWith('.ts') && !file.endsWith('.tsx')) {
        continue;
      }

      const filePath = path.join(context.targetPath, file);
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      if (!/\bany\b/.test(content)) continue;
      const lines = content.split(/\r?\n/);
      const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
      const occurrences: { line: number; indentation: string }[] = [];
      const visit = (node: ts.Node) => {
        if (node.kind === ts.SyntaxKind.AnyKeyword) {
          const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
          const lineIdx = pos.line;
          const raw = lines[lineIdx] || '';
          const indentation = raw.match(/^\s*/)?.[0] || '';
          occurrences.push({ line: lineIdx + 1, indentation });
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);

      const disableNext = 'eslint-disable-next-line @typescript-eslint/no-explicit-any';
      const disableLine = 'eslint-disable-line @typescript-eslint/no-explicit-any';
      const isSkipped = (lineNumber: number): boolean => {
        const idx = lineNumber - 1;
        const line = lines[idx] || '';
        if (line.includes(disableLine)) return true;
        let i = idx - 1;
        let consecutive = 0;
        let disableCount = 0;
        while (i >= 0) {
          const raw = lines[i] || '';
          const commentIndex = raw.indexOf('//');
          const codePart = commentIndex !== -1 ? raw.substring(0, commentIndex) : raw;
          const trimmed = raw.trim();
          const isCommentOnly = codePart.trim() === '';
          if (!isCommentOnly) break;
          consecutive += 1;
          if (trimmed.includes(disableNext)) disableCount += 1;
          i -= 1;
        }
        return consecutive > 0 && disableCount === 1;
      };

      for (const occ of occurrences) {
        if (isSkipped(occ.line)) continue;
        issues.push({
          type: 'type-safety',
          module: context.targetName,
          file: file,
          line: occ.line,
          issue: `Avoid using 'any' type. Use 'unknown' or a specific type instead.`,
          expect: `将 'any' 替换为 'unknown' 或精确的类型别名/接口，确保类型安全。`,
          level: 'error',
          fixable: false,
          data: {
            filePath,
            lineNumber: occ.line,
            indentation: occ.indentation,
          },
        });
      }
    }

    return issues;
  }
}
