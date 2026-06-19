// spec:[spec](specs/backend/rules/file/filename-naming-rule.md#L1)
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';
import path from 'path';

export interface FilenameNamingRuleOptions {
  configs: NamingConfigItem[];
}

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'filename-naming-rule': FilenameNamingRuleOptions;
  }
}

interface NamingConfigItem {
  directory: string;
  extensions: Record<
    string,
    'camelCase' | 'PascalCase' | 'snake_case' | 'kebab-case' | `regex:${string}`
  >;
  matchDirectory?: boolean;
}

export class FilenameNamingRule implements ReviewRule {
  static id = 'filename-naming-rule';
  id = FilenameNamingRule.id;
  private options?: FilenameNamingRuleOptions;
  constructor(options?: FilenameNamingRuleOptions) {
    this.options = options;
  }
  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const options = this.options;
    if (!options || !options.configs || !Array.isArray(options.configs)) {
      return issues;
    }
    const configs = options.configs;
    for (const file of context.files) {
      const fullPath = path.join(context.targetPath, file);
      const relativePath = file.replace(/\\/g, '/');
      const config = configs.find((c) => {
        if (c.directory === '.') return true;
        return relativePath.startsWith(c.directory + '/') || relativePath === c.directory;
      });
      if (!config) continue;
      const ext = path.extname(file);
      const baseName = path.basename(file, ext);
      const dirName = path.basename(path.dirname(fullPath));
      if (config.matchDirectory) {
        if (baseName !== dirName && baseName.toLowerCase() !== 'index') {
          issues.push({
            type: 'structure',
            module: context.targetName,
            file: file,
            issue: `Filename '${baseName}' should match directory name '${dirName}'.`,
            expect: `将文件名调整为与目录名一致，例如 '${dirName}${ext}'；或将该文件重命名为 index${ext} 以统一导出。`,
            level: 'warning',
            fixable: false,
          });
        }
      }
      if (config.extensions && config.extensions[ext]) {
        const style = config.extensions[ext];
        if (!checkStyle(baseName, style)) {
          issues.push({
            type: 'styling',
            module: context.targetName,
            file: file,
            issue: `Filename '${baseName}${ext}' does not match '${style}' style.`,
            expect: `将文件名改为遵循 '${style}' 命名风格，例如根据规则重写 '${baseName}${ext}' 的前缀/大小写/分隔符。`,
            level: 'warning',
            fixable: false,
          });
        }
      }
    }
    return issues;
  }
}

function checkStyle(name: string, style: string): boolean {
  if (style.startsWith('regex:')) {
    try {
      const pattern = new RegExp(style.substring(6));
      return pattern.test(name);
    } catch {
      console.warn(`Invalid regex in naming rule: ${style}`);
      return true;
    }
  }
  switch (style) {
    case 'camelCase':
      return /^[a-z][a-zA-Z0-9]*$/.test(name);
    case 'PascalCase':
      return /^[A-Z][a-zA-Z0-9]*$/.test(name);
    case 'snake_case':
      return /^[a-z][a-z0-9_]*$/.test(name);
    case 'kebab-case':
      if (name.endsWith('.test')) {
        const base = name.slice(0, -5);
        return /^[a-z][a-z0-9-]*$/.test(base);
      }
      if (name.endsWith('.spec')) {
        const base = name.slice(0, -5);
        return /^[a-z][a-z0-9-]*$/.test(base);
      }
      return /^[a-z][a-z0-9-]*$/.test(name);
    default:
      return true;
  }
}
