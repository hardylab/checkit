// spec:[spec](/specs/backend/rules/ts/entry-point-no-logic.md)
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

export interface EntryPointNoLogicOptions {
  files?: string[];
}

export class EntryPointNoLogicRule implements ReviewRule {
  static id = 'entry-point-no-logic';
  id = EntryPointNoLogicRule.id;
  private options?: EntryPointNoLogicOptions;

  constructor(options?: EntryPointNoLogicOptions) {
    this.options = options;
  }

  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const entryFiles = this.options?.files ?? ['main.ts'];

    for (const file of context.files) {
      if (!entryFiles.includes(path.basename(file))) continue;

      const filePath = path.join(context.targetPath, file);
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

      const report = (node: ts.Node, typeName: string) => {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        issues.push({
          type: 'architecture',
          module: context.targetName,
          file,
          line: line + 1,
          issue: `Entry point file should not define functions (${typeName} detected)`,
          expect:
            'Entry point file should only contain imports and calls. Move logic to other modules.',
          level: 'error',
          fixable: false,
        });
      };

      const visit = (node: ts.Node) => {
        if (ts.isFunctionDeclaration(node)) {
          report(node, 'FunctionDeclaration');
        } else if (ts.isClassDeclaration(node)) {
          // Check if class has methods?
          // The rule says "not allowed to define functions, including class member functions".
          // Defining a class usually involves defining methods. So checking ClassDeclaration covers it.
          // But maybe a class with only properties is ok?
          // "not allowed to define functions".
          // Let's be strict: no classes.
          report(node, 'ClassDeclaration');
        } else if (ts.isMethodDeclaration(node)) {
          // This is usually inside Class or ObjectLiteral.
          report(node, 'MethodDeclaration');
        } else if (ts.isFunctionExpression(node)) {
          report(node, 'FunctionExpression');
        } else if (ts.isArrowFunction(node)) {
          // Allow arrow function if it is an argument to a call?
          // E.g. .catch(e => ...)
          // User says "not allowed to define functions".
          // Strictly speaking, e => ... IS a function definition.
          // However, catch(e => ...) is very common for entry points.
          // But catch(console.error) is cleaner.
          // Let's be strict as requested "For testability...".
          report(node, 'ArrowFunction');
        }

        ts.forEachChild(node, visit);
      };

      ts.forEachChild(sourceFile, visit);
    }

    return issues;
  }
}
