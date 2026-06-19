// spec:[spec](specs/backend/rules/file/git-no-large-files.md#L1)
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'git-no-large-files': {
      maxSizeMB?: number;
      exts?: string[];
    };
  }
}

type Options = {
  maxSizeMB?: number;
  exts?: string[];
};

const DEFAULT_MAX_MB = 1;
const DEFAULT_EXTS = [
  // 二进制 / 媒体 / 压缩
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp',
  '.mp4', '.mov', '.avi', '.mkv', '.webm', '.mp3', '.wav', '.flac',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.psd', '.ai', '.sketch', '.fig',
  '.wasm',
  '.node', '.dll', '.so', '.dylib',
  // 大型构建产物
  '.map', // source map 通常跟 minified 一起,体积大
  '.lock', // 老的 lock 文件,但现代 pnpm-lock.yaml / package-lock.json 例外
];

/**
 * 限制仓库中"已知大文件"类型的体积。
 *
 * 默认检查 .png / .mp4 / .zip 等二进制文件是否 > 1MB,
 * 大概率不该入仓(应该走 CDN / S3 / LFS)。
 */
export class GitNoLargeFilesRule implements ReviewRule {
  static id = 'git-no-large-files';
  id = GitNoLargeFilesRule.id;
  private options: Options;

  constructor(options: Options = {}) {
    this.options = options;
  }

  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const maxMB = this.options.maxSizeMB ?? DEFAULT_MAX_MB;
    const exts = new Set(this.options.exts ?? DEFAULT_EXTS);
    const maxBytes = maxMB * 1024 * 1024;

    for (const file of context.files) {
      const ext = path.extname(file).toLowerCase();
      if (!exts.has(ext)) continue;

      // Windows 路径安全拼接
      const sep = context.targetPath.includes('\\') ? '\\' : '/';
      const filePath =
        context.targetPath.replace(/[\\/]+$/, '') + sep + file.replace(/^[\\/]+/, '');
      if (!fs.existsSync(filePath)) continue;

      let size: number;
      try {
        size = fs.statSync(filePath).size;
      } catch {
        continue;
      }

      if (size > maxBytes) {
        issues.push({
          type: 'security',
          module: context.targetName,
          file,
          line: 1,
          issue: `Large file detected: ${(size / 1024 / 1024).toFixed(2)}MB (max ${maxMB}MB for ${ext})`,
          expect: 'Move binary assets to CDN / S3 / Git LFS. Do not commit large files directly.',
          level: 'error',
          fixable: false,
          data: { filePath, size, maxMB, ext },
        });
      }
    }

    return issues;
  }
}
