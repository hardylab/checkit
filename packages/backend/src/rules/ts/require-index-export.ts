// spec:[spec](specs/backend/rules/require-index-export.md#L1)
import { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';
import * as ts from 'typescript';

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'require-index-export': {};
  }
}

export class RequireIndexExportRule implements ReviewRule {
  static id = 'require-index-export';
  id = RequireIndexExportRule.id;
  constructor(_: {}) {}
  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const dirFiles = new Map<string, string[]>();
    for (const file of context.files) {
      const ext = path.extname(file).toLowerCase();
      if (ext !== '.ts' && ext !== '.tsx') continue;
      const dir = path.dirname(file);
      const list = dirFiles.get(dir) || [];
      list.push(file);
      dirFiles.set(dir, list);
    }
    for (const [dir, files] of dirFiles.entries()) {
      const isTestDir = /(^|[\\/])test([\\/]|$)/.test(dir);
      if (isTestDir) continue;
      const moduleFiles = files.filter((f) => path.basename(f) !== 'index.ts');
      if (moduleFiles.length === 0) continue;
      const indexRel = path.join(dir, 'index.ts');
      const indexAbs = path.join(context.targetPath, indexRel);
      const hasIndex = fs.existsSync(indexAbs);
      if (!hasIndex) {
        issues.push({
          type: 'structure',
          module: context.targetName,
          file: indexRel,
          issue: `目录 "${dir}" 缺少 index.ts 用于统一导出`,
          fixable: true,
          level: 'error',
          data: {
            indexAbs,
            dir,
            moduleBases: moduleFiles.map((f) => path.basename(f, path.extname(f))),
          },
        });
        continue;
      }
      const content = fs.readFileSync(indexAbs, 'utf-8');
      const exported = collectExportModuleSpecifiers(indexAbs, content);
      for (const f of moduleFiles) {
        const base = path.basename(f, path.extname(f));
        const exists = exported.has(`./${base}`) || exported.has(`./${base}/`);
        if (!exists) {
          issues.push({
            type: 'structure',
            module: context.targetName,
            file: indexRel,
            issue: `index.ts 未统一导出: 缺少 "./${base}"`,
            fixable: true,
            level: 'error',
            data: {
              indexAbs,
              dir,
              base,
            },
          });
        }
      }
    }
    return issues;
  }
  fix(issue: ReviewIssue): boolean {
    const data = issue.data || {};
    const indexAbs = typeof data.indexAbs === 'string' ? (data.indexAbs as string) : undefined;
    const dir = typeof data.dir === 'string' ? (data.dir as string) : undefined;
    if (!indexAbs || !dir) return false;
    if (!fs.existsSync(indexAbs)) {
      const moduleBases = Array.isArray(data.moduleBases) ? (data.moduleBases as string[]) : [];
      const lines = moduleBases.map((b) => `export * from './${b}';`);
      fs.mkdirSync(path.dirname(indexAbs), { recursive: true });
      fs.writeFileSync(indexAbs, lines.join('\n') + '\n', 'utf-8');
      return true;
    }
    const base = typeof data.base === 'string' ? (data.base as string) : undefined;
    if (!base) return false;
    const content = fs.readFileSync(indexAbs, 'utf-8');
    const exported = collectExportModuleSpecifiers(indexAbs, content);
    if (exported.has(`./${base}`) || exported.has(`./${base}/`)) {
      return false;
    }
    const newLine = `export * from './${base}';\n`;
    fs.writeFileSync(
      indexAbs,
      content.endsWith('\n') ? content + newLine : content + '\n' + newLine,
      'utf-8'
    );
    return true;
  }
}

function collectExportModuleSpecifiers(fileName: string, content: string): Set<string> {
  const sf = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const specs = new Set<string>();
  for (const stmt of sf.statements) {
    if (
      ts.isExportDeclaration(stmt) &&
      stmt.moduleSpecifier &&
      ts.isStringLiteral(stmt.moduleSpecifier)
    ) {
      const text = stmt.moduleSpecifier.text;
      if (text.startsWith('./')) {
        specs.add(text);
      }
    }
  }
  return specs;
}
