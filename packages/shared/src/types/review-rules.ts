/**
 * spec:[Code Review Rules](/docs/710-code-review-rules.md)
 */

export interface ReviewIssue {
  type:
    | 'structure'
    | 'traceability'
    | 'styling'
    | 'state'
    | 'documentation'
    | 'architecture'
    | 'type-safety'
    | 'security';
  module: string; // "brick" here can also mean "project" or "module"
  file?: string;
  line?: number;
  // 面向 AI 的问题描述，用于阐明需要修复的具体问题
  issue: string;
  // 当规则未提供 fix() 时，用于说明预期的修复方式
  expect?: string;
  fixable?: boolean;
  level: 'error' | 'warning' | 'info';
  /**
   * Additional data required for fixing the issue or other purposes.
   */
  data?: Record<string, unknown>;
}

export interface RuleContext {
  cwd: string; // Execution directory
  projectRoot: string; // Monorepo Root
  targetPath: string; // Current target directory path
  targetName: string; // Brick Name or Project Name
  targetType: 'brick' | 'project' | 'root';
  files: string[]; // List of files in the target directory (names only)
  autoFix: boolean; // Whether auto-fix is enabled
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ReviewRuleRegistry {
  'function-size-limit': { maxLines?: number };
  'recent-files-lint-fix': { timeWindowMinutes?: number };
  'recent-files-format': { timeWindowMinutes?: number };
  'entry-point-no-logic': { files?: string[] };
  'doc-pattern': DocPatternConfig;
}

export type DocPatternChecker = (content: string) => boolean;

export interface DocPatternConfig {
  [key: string]: boolean | DocPatternChecker | DocPatternConfig;
}

export interface ReviewRule {
  /**
   * Unique identifier for the rule
   */
  id: string;

  /**
   * Optional glob pattern to filter files.
   * If provided, the rule will only receive files matching this pattern.
   */
  glob?: string;

  check: (context: RuleContext) => ReviewIssue[];

  fix?: (issue: ReviewIssue) => boolean;

  /**
   * Whether this rule can be ignored via file header directive:
   * e.g., "review-ignore: rule-id-a, rule-id-b"
   */
  ignorable?: boolean;

  /**
   * Optional flow configuration for ordering dependencies.
   * If a rule in a flow fails (produces issues), subsequent rules in the same flow are skipped.
   */
  flow?: {
    key: string;
    order: number;
  };
}

export type RuleConstructor<K extends keyof ReviewRuleRegistry> = new (
  options?: ReviewRuleRegistry[K]
) => ReviewRule;

export interface Paradigm {
  name: string;
  description: string;
  autofix: boolean;
  rules: {
    [K in keyof ReviewRuleRegistry]?: {
      autofix?: boolean;
      issue?: ReviewIssue['level'];
      options?: ReviewRuleRegistry[K];
    };
  };
}
