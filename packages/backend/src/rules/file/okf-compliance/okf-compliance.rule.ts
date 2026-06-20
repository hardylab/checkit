// spec:[OKF v0.1](https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing)
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import type { ReviewIssue, RuleContext, ReviewRule } from '@checkit/shared';
import { windowSafeJoin, tryReadFile } from '../../_shared/utils';

/**
 * OKF(Open Knowledge Format)兼容规则
 *
 * 检查 .md 文件 frontmatter 是否兼容 OKF v0.1 字段。
 *
 * check() 检测:type / title / timestamp 3 个关键字段
 * fix() 自动修:补 type: rule + timestamp: 当前日期(不动 title,因为需要人类判断)
 *
 * 5 步闭环:checkit rule 必须支持 fix()(rule-structure 强制)
 */
const OKF_REQUIRED_FIELDS = ['type', 'title', 'timestamp'] as const;

const OkfComplianceRule: ReviewRule = class OkfComplianceRule {
  static id = 'okf-compliance';
  id = OkfComplianceRule.id;
  glob = '**/*.md';

  constructor(_: unknown) {}

  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const seenFiles = new Set<string>();

    for (const file of context.files) {
      if (!file.endsWith('.md')) continue;
      if (file.includes('/test/') || file.includes('\\test\\')) continue;
      if (file.includes('/node_modules/') || file.includes('\\node_modules\\')) continue;
      if (file.includes('/dist/') || file.includes('\\dist\\')) continue;

      if (seenFiles.has(file)) continue;
      seenFiles.add(file);

      const filePath = windowSafeJoin(context.targetPath, file);
      if (!fs.existsSync(filePath)) continue;

      const content = tryReadFile(filePath);
      if (!content) continue;

      const frontmatter = parseFrontmatter(content);
      const missing = OKF_REQUIRED_FIELDS.filter(
        (f) => !(f in frontmatter) || frontmatter[f] === '' || frontmatter[f] == null
      );

      if (missing.length > 0) {
        const fileName = path.basename(file);
        issues.push({
          type: 'documentation',
          module: fileName,
          file,
          issue: `${fileName} missing OKF frontmatter fields: ${missing.join(', ')} — OKF v0.1 spec requires type, title, timestamp for AI-agent consumption`,
          expect: `Add to frontmatter:\n  type: rule\n  timestamp: ${new Date().toISOString().split('T')[0]}\n  title: <one-line title>\nSee https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing`,
          level: 'warning',
          fixable: true,
          data: {
            filePath,
            missingFields: missing,
            currentFrontmatter: frontmatter,
          },
        });
      }
    }

    return issues;
  }

  /**
   * fix() —— rule 自己的修复逻辑
   *
   * 自动补:
   * - type: rule
   * - timestamp: 当前日期(YYYY-MM-DD)
   *
   * 不动 title(需要人类判断)
   */
  fix(issue: ReviewIssue): boolean {
    const filePath = issue.data?.filePath as string | undefined;
    const missingFields = issue.data?.missingFields as string[] | undefined;
    if (!filePath || !fs.existsSync(filePath)) return false;

    const content = tryReadFile(filePath);
    if (!content) return false;

    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return false;

    let block = match[1];
    const original = block;
    const today = new Date().toISOString().split('T')[0];

    for (const field of missingFields || []) {
      if (field === 'type' && !/^type\s*:/m.test(block)) {
        block = `type: rule\n${block}`;
      } else if (field === 'timestamp' && !/^timestamp\s*:/m.test(block)) {
        if (/^title\s*:/m.test(block)) {
          block = block.replace(/^(title\s*:.*)$/m, `$1\ntimestamp: ${today}`);
        } else {
          block += `\ntimestamp: ${today}`;
        }
      }
      // title 不自动补(需要人类写)
    }

    if (block === original) return false;

    const newContent = content.replace(/^---\s*\n([\s\S]*?)\n---/, `---\n${block}\n---`);
    fs.writeFileSync(filePath, newContent, 'utf-8');
    return true;
  }
};

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const block = match[1];
  const out: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const m = line.match(/^([a-zA-Z_][\w-]*)\s*:\s*(.*)$/);
    if (m) {
      const key = m[1];
      let value = m[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
  }
  return out;
}

export default OkfComplianceRule;
export { OkfComplianceRule };
