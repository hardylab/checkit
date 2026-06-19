// spec:[spec](specs/backend/rules/file/git-no-secrets-in-history.md#L1)
import { execSync } from 'child_process';
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'git-no-secrets-in-history': {
      maxCommits?: number;
      extraPatterns?: string[];
    };
  }
}

type Options = {
  maxCommits?: number;
  extraPatterns?: string[];
};

// 常见密钥模式(简化版,生产可用 trufflehog / gitleaks)
const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'AWS Access Key', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'AWS Secret Key', re: /[A-Za-z0-9/+=]{40}(?=.*aws|.*secret)/i },
  { name: 'Generic API Key', re: /(api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_\-]{20,}['"]/i },
  { name: 'Private Key Block', re: /-----BEGIN (RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: 'GitHub Token', re: /gh[pousr]_[A-Za-z0-9]{36,}/ },
  { name: 'Slack Token', re: /xox[abpr]-[0-9A-Za-z\-]+/ },
  { name: 'JWT', re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'Generic password assignment', re: /(password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/i },
];

/**
 * 扫 git 历史最近 N 个 commit,检查是否泄漏密钥。
 *
 * 跟 plaintext-credentials 不同:那条规则只扫当前文件,
 * 这条扫 git history —— 哪怕密钥已经从 .gitignore 移除,仍可能在历史 commit 里。
 */
export class GitNoSecretsInHistoryRule implements ReviewRule {
  static id = 'git-no-secrets-in-history';
  id = GitNoSecretsInHistoryRule.id;
  private options: Options;

  constructor(options: Options = {}) {
    this.options = options;
  }

  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const maxCommits = this.options.maxCommits ?? 50;

    // 1. 确认 cwd 在 git 仓里
    try {
      execSync('git rev-parse --git-dir', {
        cwd: context.targetPath,
        stdio: 'pipe',
      });
    } catch {
      // 不是 git 仓,跳过
      return [];
    }

    // 2. 取最近 N 个 commit 的 diff(只加 -- + 移除 -- 才看)
    // 简化:用 git log -p 取 diff,然后 grep 模式
    // 性能考虑:limit commit 数
    let logOutput: string;
    try {
      logOutput = execSync(
        `git log -p --no-color -n ${maxCommits}`,
        { cwd: context.targetPath, stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 }
      ).toString();
    } catch {
      return [];
    }

    // 3. 扫每个 pattern
    const patterns = [
      ...SECRET_PATTERNS,
      ...(this.options.extraPatterns ?? []).map((p) => ({
        name: 'Custom',
        re: new RegExp(p),
      })),
    ];

    const foundSet = new Set<string>(); // 去重(同一行只报一次)
    for (const { name, re } of patterns) {
      const matches = logOutput.matchAll(new RegExp(re.source, re.flags + 'g'));
      for (const m of matches) {
        const key = `${name}::${m[0].slice(0, 20)}`;
        if (foundSet.has(key)) continue;
        foundSet.add(key);

        // 提取 commit hash (diff 头部)
        const commitMatch = logOutput.slice(0, m.index).match(/^commit ([a-f0-9]+)/gm);
        const commitHash = commitMatch ? commitMatch[commitMatch.length - 1].slice(7, 17) : 'unknown';

        issues.push({
          type: 'security',
          module: context.targetName,
          file: `git history (commit ${commitHash})`,
          line: 1,
          issue: `Possible ${name} found in git history: "${m[0].slice(0, 40)}..."`,
          expect:
            'Rotate the credential immediately. Use `git filter-repo` to remove from history, or rotate key + accept history leak (less safe).',
          level: 'error',
          fixable: false,
          data: { pattern: name, commitHash, sample: m[0].slice(0, 40) },
        });
      }
    }

    return issues;
  }
}
