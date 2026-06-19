// spec:[spec](specs/backend/rules/ts/plaintext-credentials.md#L1)
import fs from 'fs';
import path from 'path';
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';
import ts from 'typescript';

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'plaintext-credentials': {
      allowIdentifiers?: string[];
      minLength?: number;
    };
  }
}

type Options = {
  allowIdentifiers?: string[];
  minLength?: number;
};

export class PlaintextCredentialsRule implements ReviewRule {
  static id = 'plaintext-credentials';
  id = PlaintextCredentialsRule.id;
  private options: Options;
  constructor(options: Options = {}) {
    this.options = options;
  }
  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const minLen = this.options.minLength ?? 8;
    const allowList = new Set(
      (this.options.allowIdentifiers ?? []).map((s) => s.trim().toLowerCase())
    );
    const keyRe =
      /^(api[_-]?key|password|passwd|passphrase|secret|client[_-]?secret|access[_-]?(?:key|token)|refresh[_-]?token)$/i;
    const assignRe = new RegExp(
      `(api[_-]?key|password|passwd|passphrase|secret|client[_-]?secret|access[_-]?(?:key|token)|refresh[_-]?token)\\s*[:=]\\s*(['"])([^'"]{${minLen},})\\2`,
      'i'
    );
    const jsonAssignRe = new RegExp(
      `"(?:api[_-]?key|password|passwd|passphrase|secret|client[_-]?secret|access[_-]?(?:key|token)|refresh[_-]?token)"\\s*:\\s*"(?:.{${minLen},})"`,
      'i'
    );

    const isSensitiveKey = (name: string | ts.__String): boolean => {
      const n = String(name).replace(/["']/g, '').toLowerCase();
      if (allowList.has(n)) return false;
      return keyRe.test(n);
    };
    for (const rel of context.files) {
      if (
        !rel.endsWith('.ts') &&
        !rel.endsWith('.tsx') &&
        !rel.endsWith('.js') &&
        !rel.endsWith('.jsx')
      )
        continue;
      if (/(^|[\\/])test([\\/]|$)/.test(rel)) continue;
      const filePath = path.join(context.targetPath, rel);
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf-8');
      const hitAssign = assignRe.exec(content);
      const hitJson = jsonAssignRe.exec(content);
      if (!(hitAssign || hitJson)) continue;

      // AST confirmation
      const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
      const reportAt = (pos: number) => {
        const lc = sf.getLineAndCharacterOfPosition(pos);
        issues.push({
          type: 'security',
          module: context.targetName,
          file: rel,
          line: lc.line + 1,
          issue:
            '检测到可能的明文敏感凭据（API key/password/secret 等）。请改用环境变量、密钥管理或加密存储。',
          expect:
            '将敏感信息移出代码：使用环境变量、机密管理服务或加密存储，并在代码中通过安全读取方式引用。',
          level: 'error',
          fixable: false,
        });
      };
      const checkLiteralLen = (lit: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral) =>
        (lit.text || '').length >= minLen;
      const checkAssign = (name: string | ts.__String, init: ts.Expression, pos: number) => {
        if (!isSensitiveKey(name)) return;
        if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) {
          if (checkLiteralLen(init)) reportAt(pos);
        }
      };
      const checkPropertyAssignment = (pa: ts.PropertyAssignment) => {
        const name = ts.isIdentifier(pa.name)
          ? pa.name.text
          : ts.isStringLiteral(pa.name)
            ? pa.name.text
            : undefined;
        if (!name) return;
        checkAssign(name, pa.initializer, pa.getStart(sf));
      };
      const checkNode = (node: ts.Node): void => {
        if (ts.isVariableDeclaration(node) && node.initializer) {
          if (ts.isIdentifier(node.name)) {
            checkAssign(node.name.text, node.initializer, node.getStart(sf));
          }
          if (ts.isObjectLiteralExpression(node.initializer)) {
            for (const p of node.initializer.properties) {
              if (ts.isPropertyAssignment(p)) checkPropertyAssignment(p);
            }
          }
        } else if (ts.isBinaryExpression(node)) {
          if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            const right = node.right;
            let leftName: string | undefined;
            if (ts.isIdentifier(node.left)) {
              leftName = node.left.text;
            } else if (ts.isPropertyAccessExpression(node.left)) {
              leftName = node.left.name.text;
            } else if (ts.isElementAccessExpression(node.left)) {
              const arg = node.left.argumentExpression;
              if (ts.isStringLiteral(arg)) leftName = arg.text;
            }
            if (leftName) checkAssign(leftName, right, node.getStart(sf));
          }
        } else if (ts.isPropertyAssignment(node)) {
          checkPropertyAssignment(node);
        }
        ts.forEachChild(node, checkNode);
      };
      checkNode(sf);
    }
    return issues;
  }
}
