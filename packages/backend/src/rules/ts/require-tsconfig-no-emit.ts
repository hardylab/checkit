// spec:[spec](specs/backend/rules/require-tsconfig-no-emit.md#L1)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'require-tsconfig-no-emit': {};
  }
}

export class RequireTsconfigNoEmitRule implements ReviewRule {
  static id = 'require-tsconfig-no-emit';
  id = RequireTsconfigNoEmitRule.id;
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor(_: {}) {}
  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const targets = context.files.filter((f) => {
      const base = path.basename(f).toLowerCase();
      return base.startsWith('tsconfig') && (base.endsWith('.json') || base.endsWith('.jsonc'));
    });
    for (const file of targets) {
      const abs = path.join(context.targetPath, file);
      if (!fs.existsSync(abs)) continue;
      const raw = fs.readFileSync(abs, 'utf-8');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: any;
      try {
        parsed = JSON.parse(stripJsonComments(raw));
      } catch {
        issues.push({
          type: 'structure',
          module: context.targetName,
          file,
          issue: `无法解析 "${file}"，请使用有效的 JSON/JSONC 格式并设置 compilerOptions.noEmit 为 true`,
          level: 'error',
          fixable: false,
        });
        continue;
      }
      const compilerOptions = parsed?.compilerOptions ?? {};
      const noEmit = compilerOptions?.noEmit;
      if (noEmit !== true) {
        issues.push({
          type: 'structure',
          module: context.targetName,
          file,
          issue: `tsconfig "${file}" 必须将 compilerOptions.noEmit 设为 true`,
          level: 'error',
          fixable: true,
          data: { absolutePath: abs },
        });
      }
    }
    return issues;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fix(issue: ReviewIssue): boolean {
    const abs = (issue.data && (issue.data as Record<string, unknown>)['absolutePath']) as
      | string
      | undefined;
    if (!abs) return false;
    const exists = fs.existsSync(abs);
    if (!exists) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = fs.readFileSync(abs, 'utf-8');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any;
    try {
      parsed = JSON.parse(stripJsonComments(raw));
    } catch {
      return false;
    }
    parsed.compilerOptions = parsed.compilerOptions ?? {};
    parsed.compilerOptions.noEmit = true;
    fs.writeFileSync(abs, JSON.stringify(parsed, null, 2) + '\n', 'utf-8');
    return true;
  }
}

function stripJsonComments(input: string): string {
  // Remove /* ... */ block comments
  let s = input.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove // line comments
  s = s.replace(/(^|\s)\/\/.*$/gm, '');
  return s;
}
