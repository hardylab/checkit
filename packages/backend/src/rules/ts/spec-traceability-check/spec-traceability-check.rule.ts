// spec:[spec](/specs/backend/rules/spec-traceability-check.md)
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

export interface SpecTraceabilityOptions {
  directories?: string[];
  keywords?: string[];
  timeWindowMinutes?: number;
}

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'spec-traceability-check': SpecTraceabilityOptions;
  }
}

function shouldCheck(file: string, targetPath: string, options?: SpecTraceabilityOptions): boolean {
  const dirs =
    options?.directories && options.directories.length > 0
      ? options.directories
      : ['controllers', 'services'];
  const fullPath = path.join(targetPath, file).replace(/\\/g, '/');
  const rel = file.replace(/\\/g, '/');
  const dirHit = dirs.some(
    (d) =>
      rel.includes(`/${d}/`) ||
      rel.startsWith(`${d}/`) ||
      path.basename(path.dirname(fullPath)) === d
  );
  return dirHit;
}

function contentHasKeywords(content: string, options?: SpecTraceabilityOptions): boolean {
  const kws =
    options?.keywords && options.keywords.length > 0 ? options.keywords : ['controller', 'service'];
  const lc = content.toLowerCase();
  return kws.some((k) => {
    const token = k.trim().toLowerCase();
    if (!token) return false;
    return lc.includes(token);
  });
}

function fileNameHasKeywords(file: string, options?: SpecTraceabilityOptions): boolean {
  const kws =
    options?.keywords && options.keywords.length > 0 ? options.keywords : ['controller', 'service'];
  const baseLower = path.basename(file).toLowerCase();
  return kws.some((k) => baseLower.includes(k.trim().toLowerCase()));
}

export class SpecTraceabilityCheckRule implements ReviewRule {
  static id = 'spec-traceability-check';
  id = SpecTraceabilityCheckRule.id;
  private options?: SpecTraceabilityOptions;
  constructor(options?: SpecTraceabilityOptions) {
    this.options = options;
  }
  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const timeWindow = this.options?.timeWindowMinutes ?? 60;
    const cutoff = Date.now() - timeWindow * 60 * 1000;

    for (const file of context.files) {
      if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
      if (/(^|[\\/])test([\\/]|$)/.test(file)) continue;
      const filePath = path.join(context.targetPath, file);
      if (!fs.existsSync(filePath)) continue;

      const stat = fs.statSync(filePath);
      const isRecent = stat.mtimeMs >= cutoff || stat.birthtimeMs >= cutoff;
      const content = fs.readFileSync(filePath, 'utf-8');

      const specMatch = content.match(/\/\/\s*spec:\[spec\]\(([^)]+)\)/);

      if (specMatch) {
        if (isRecent) {
          const link = specMatch[1];
          // Resolve link
          let specPath: string;
          // If link starts with /, treat as relative to project root
          if (link.startsWith('/') || link.startsWith('\\')) {
            specPath = path.join(context.projectRoot, link);
          } else {
            // Treat as relative to current file
            specPath = path.resolve(path.dirname(filePath), link);
          }

          if (!fs.existsSync(specPath)) {
            issues.push({
              type: 'traceability',
              module: context.targetName,
              file,
              issue: `关联的 spec 文件不存在: ${link}`,
              expect: `请确保 spec 文件存在于正确路径: ${specPath}`,
              level: 'error',
              fixable: false,
              data: { filePath },
            });
          } else {
            const specContent = fs.readFileSync(specPath, 'utf-8');
            // Check for substantial content (> 50 chars)
            if (specContent.trim().length < 50) {
              issues.push({
                type: 'traceability',
                module: context.targetName,
                file,
                issue: `关联的 spec 文件内容过少: ${link}`,
                expect: `请确保 spec 文件包含实质性内容（>50字符）`,
                level: 'error',
                fixable: false,
                data: { filePath },
              });
            }
          }
        }
      } else {
        const okScope =
          shouldCheck(file, context.targetPath, this.options) ||
          fileNameHasKeywords(file, this.options) ||
          contentHasKeywords(content, this.options);

        if (okScope) {
          issues.push({
            type: 'traceability',
            module: context.targetName,
            file,
            issue:
              '缺少规范追踪注释：请在文件顶部添加 // spec:[spec](/specs/...) 链接；建议使用 openspec 生成并插入规范链接',
            level: 'warning',
            fixable: false,
            data: { filePath },
          });
        }
      }
    }
    return issues;
  }
  fix(issue: ReviewIssue): boolean {
    void issue;
    return false;
  }
}
