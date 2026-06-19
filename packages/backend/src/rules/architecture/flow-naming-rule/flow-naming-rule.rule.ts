// spec:[spec](specs/flow-naming-rule/spec.md#L1)
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'flow-naming-rule': {};
  }
}

export class FlowNamingRule implements ReviewRule {
  static id = 'flow-naming-rule';
  id = FlowNamingRule.id;

  constructor(_: {}) {}
  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    for (const file of context.files) {
      if (
        !file.endsWith('.ts') ||
        file.endsWith('.d.ts') ||
        file.endsWith('.test.ts') ||
        file.endsWith('.spec.ts')
      ) {
        continue;
      }

      const filePath = path.join(context.targetPath, file);
      let content = '';
      try {
        content = fs.readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }

      // Find all class definitions
      const classRegex = /class\s+(\w+)(?:\s+implements\s+[^{]+)?\s*\{/g;
      const classes: { name: string; index: number }[] = [];
      let match;
      while ((match = classRegex.exec(content)) !== null) {
        classes.push({ name: match[1], index: match.index });
      }

      if (classes.length === 0) continue;

      // Find all flow definitions
      // Matches flow configuration objects with a 'key' property
      // We look for "flow" followed by optional type, then "=" or ":", then "{", then eventually "key:"
      const flowRegex = /\bflow\s*(?::[^=]+)?\s*[=:]\s*\{[\s\S]*?key:\s*['"]([^'"]+)['"]/g;

      while ((match = flowRegex.exec(content)) !== null) {
        const flowKey = match[1];
        const flowIndex = match.index;

        // Find the class this flow belongs to
        // It should be the class with the largest index that is still smaller than flowIndex
        const classDef = classes
          .slice()
          .reverse()
          .find((c) => c.index < flowIndex);

        if (!classDef) continue; // Flow defined outside of any class? Unlikely but possible in some weird code

        // Check Class Name
        const expectedClassPrefix = this.toPascalCase(flowKey);
        if (!classDef.name.startsWith(expectedClassPrefix)) {
          issues.push({
            type: 'architecture',
            module: context.targetName,
            file,
            level: 'error',
            issue: `Class '${classDef.name}' belongs to flow '${flowKey}' but does not start with '${expectedClassPrefix}'.`,
            expect: `将类名修改为以 '${expectedClassPrefix}' 开头，例如 '${expectedClassPrefix}${classDef.name.replace(/^([A-Z][a-z]*)?/, '')}'.`,
            fixable: false,
          });
        }

        // Check Filename
        const fileName = path.basename(file, '.ts');
        const expectedFilePrefix = this.toKebabCase(flowKey) + '-';
        if (!fileName.startsWith(expectedFilePrefix)) {
          issues.push({
            type: 'architecture',
            module: context.targetName,
            file,
            level: 'error',
            issue: `File '${fileName}.ts' contains flow '${flowKey}' rule but filename does not start with '${expectedFilePrefix}'.`,
            expect: `将文件名修改为以 '${expectedFilePrefix}' 开头，例如 '${expectedFilePrefix}${fileName}.ts'`,
            fixable: false,
          });
        }
      }
    }

    return issues;
  }

  private toPascalCase(str: string): string {
    // Handle kebab-case, snake_case, or space separated
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
      .replace(/^(.)/, (c) => c.toUpperCase());
  }

  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }
}
