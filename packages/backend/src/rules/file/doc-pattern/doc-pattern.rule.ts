import type {
  ReviewRule,
  ReviewIssue,
  RuleContext,
  DocPatternConfig,
  DocPatternChecker,
} from '@checkit/shared';
import fs from 'fs';
import path from 'path';

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'doc-pattern': DocPatternConfig;
  }
}

export class DocPatternRule implements ReviewRule {
  static id = 'doc-pattern';
  id = DocPatternRule.id;
  constructor(public options: DocPatternConfig = {}) {}

  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const targetPath = context.targetPath;

    this.checkPatterns(targetPath, this.options, issues, context.targetName);

    return issues;
  }

  private checkValue(
    pattern: boolean | DocPatternChecker | DocPatternConfig
  ): pattern is DocPatternChecker {
    return typeof pattern === 'function';
  }

  private checkObject(
    pattern: boolean | DocPatternChecker | DocPatternConfig
  ): pattern is DocPatternConfig {
    return typeof pattern === 'object' && pattern !== null && !this.checkValue(pattern);
  }

  private checkPatterns(
    basePath: string,
    patterns: DocPatternConfig,
    issues: ReviewIssue[],
    moduleName: string,
    baseRelativePath: string = ''
  ): void {
    for (const [name, pattern] of Object.entries(patterns)) {
      const fullPath = path.join(basePath, name);
      const relativePath = baseRelativePath
        ? path.join(baseRelativePath, name).replace(/\\/g, '/')
        : name;

      if (typeof pattern === 'boolean') {
        if (pattern) {
          if (!fs.existsSync(fullPath)) {
            issues.push({
              type: 'structure',
              module: moduleName,
              file: relativePath,
              issue: `Required path is missing: ${name}`,
              expect: `${name} should exist`,
              level: 'error',
              data: { path: relativePath },
            });
          }
        }
      } else if (this.checkValue(pattern)) {
        if (!fs.existsSync(fullPath)) {
          issues.push({
            type: 'structure',
            module: moduleName,
            file: relativePath,
            issue: `Required file is missing: ${name}`,
            expect: `${name} should exist`,
            level: 'error',
            data: { path: relativePath },
          });
        } else {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (!pattern(content)) {
            issues.push({
              type: 'structure',
              module: moduleName,
              file: relativePath,
              issue: `File ${name} does not meet content requirements`,
              expect: `Content should match the required pattern`,
              level: 'error',
              data: { path: relativePath },
            });
          }
        }
      } else if (this.checkObject(pattern)) {
        if (!fs.existsSync(fullPath)) {
          issues.push({
            type: 'structure',
            module: moduleName,
            file: relativePath,
            issue: `Required directory is missing: ${name}`,
            expect: `Directory ${name} should exist`,
            level: 'error',
            data: { path: relativePath },
          });
        } else {
          this.checkPatterns(fullPath, pattern, issues, moduleName, relativePath);
        }
      }
    }
  }
}
