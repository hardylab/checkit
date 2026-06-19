// spec:[spec](specs/backend/rules/file/utf8-encoding-required.md#L1)
import fs from 'fs';
import path from 'path';
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'utf8-encoding-required': {
      includeExtensions?: string[];
      excludePatterns?: string[];
      allowBom?: boolean;
    };
  }
}

type Options = {
  includeExtensions?: string[];
  excludePatterns?: string[];
  allowBom?: boolean;
};

export class Utf8EncodingRequiredRule implements ReviewRule {
  static id = 'utf8-encoding-required';
  id = Utf8EncodingRequiredRule.id;
  private options: Options;
  constructor(options: Options) {
    this.options = options || {};
  }
  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const include =
      this.options.includeExtensions && this.options.includeExtensions.length > 0
        ? new Set(this.options.includeExtensions.map((e) => (e.startsWith('.') ? e : `.${e}`)))
        : new Set([
            '.ts',
            '.tsx',
            '.js',
            '.jsx',
            '.json',
            '.md',
            '.css',
            '.scss',
            '.html',
            '.txt',
            '.yaml',
            '.yml',
            '.cjs',
            '.mjs',
          ]);
    const excludes = this.options.excludePatterns || [];
    const allowBom = !!this.options.allowBom;
    for (const rel of context.files) {
      const ext = path.extname(rel).toLowerCase();
      if (!include.has(ext)) continue;
      if (excludes.some((p) => rel.includes(p))) continue;
      const filePath = path.join(context.targetPath, rel);
      if (!fs.existsSync(filePath)) continue;
      const buf = fs.readFileSync(filePath);
      const hasBom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
      const str = buf.toString('utf8');
      const hasReplacement = str.includes('\uFFFD');
      if ((hasBom && !allowBom) || hasReplacement) {
        issues.push({
          type: 'styling',
          module: context.targetName,
          file: rel,
          line: 1,
          issue: hasReplacement
            ? '文件编码不是 UTF-8，检测到非法编码替换字符'
            : '文件包含 UTF-8 BOM，不符合无 BOM 要求',
          level: 'error',
          fixable: hasBom && !hasReplacement,
          data: {
            filePath,
            hasBom,
          },
        });
      }
    }
    return issues;
  }
  fix(issue: ReviewIssue): boolean {
    const data = issue.data as { filePath?: string; hasBom?: boolean } | undefined;
    if (!data || !data.filePath) return false;
    try {
      const buf = fs.readFileSync(data.filePath);
      const hasBom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
      if (!hasBom) return false;
      const sliced = buf.slice(3);
      const content = sliced.toString('utf8');
      const eol = content.includes('\r\n') ? '\r\n' : '\n';
      const normalized = content.split(/\r?\n/).join(eol);
      fs.writeFileSync(data.filePath, normalized, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }
}
