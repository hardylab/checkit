// spec:[OKF v0.1](https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing)
import fs from 'fs';
import path from 'path';
import type { ReviewIssue, RuleContext } from '@checkit/shared';
import { windowSafeJoin, tryReadFile } from '../../_shared/utils';

/**
 * OKF(Open Knowledge Format)兼容规则
 *
 * 检查 .md 文件 frontmatter 是否兼容 OKF v0.1 字段。
 *
 * OKF 6 个核心字段:
 * - type: 'rule' | 'doc' | 'wiki' | 'bundle' | 'concept'
 * - title: 短标题
 * - description: 详细描述
 * - resource: 外部资源(可选)
 * - tags: 标签数组
 * - timestamp: ISO8601 时间戳
 *
 * 设计选择:
 * - 不强制所有 6 个字段,只检测 3 个关键的(type / title / timestamp)
 * - tags 视为可选(允许空)
 * - description 可以从第一段自动提取(不强求)
 * - type 必须是 'rule'(对 checkit rule doc 来说)
 *
 * 触发:warn 级别(OKF 是新标准,6 天前发布,容错优先)
 */

const OKF_REQUIRED_FIELDS = ['type', 'title', 'timestamp'] as const;

const OkfComplianceRule = class OkfComplianceRule {
  static id = 'okf-compliance';
  id = OkfComplianceRule.id;
  glob = '**/*.md';

  constructor(_: unknown) {}

  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const seenFiles = new Set<string>();

    for (const file of context.files) {
      // 只查 .md 文件
      if (!file.endsWith('.md')) continue;
      // 排除 test / node_modules / dist
      if (file.includes('/test/') || file.includes('\\test\\')) continue;
      if (file.includes('/node_modules/') || file.includes('\\node_modules\\')) continue;
      if (file.includes('/dist/') || file.includes('\\dist\\')) continue;

      // 去重
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
};

/**
 * 简易 YAML frontmatter 解析
 *
 * 只解析 `key: value` 简单形式(不处理嵌套 / 数组完整语法)。
 * 因为 OKF 6 个字段都是简单 key:value,不需要复杂 parser。
 */
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
      // 去掉 YAML 字符串引号
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
