/**
 * CheckIt 配置类型定义
 *
 * 设计原则:类 ESLint,支持渐进式配置
 * - 零配置可跑(内置 defaultParadigm)
 * - extends 复用 preset
 * - rules 支持简写("error")和详细写法({ level, type, options })
 * - ignorePatterns 在配置内 / .checkitignore 文件 / CLI 三层叠加
 */

/**
 * 规则的配置项
 *
 * 简写:"off" | "warn" | "error"
 * 详细:{ level, type, options, autofix }
 */
export type RuleConfig =
  | 'off'
  | 'warn'
  | 'error'
  | {
      level?: 'off' | 'warn' | 'error';
      type?:
        | 'structure'
        | 'traceability'
        | 'styling'
        | 'state'
        | 'documentation'
        | 'architecture'
        | 'type-safety'
        | 'security';
      options?: Record<string, unknown>;
      autofix?: boolean;
    };

/**
 * 顶层 CheckIt 配置
 *
 * 支持文件格式:
 * - checkit.config.json
 * - checkit.config.yaml / .yml
 * - checkit.config.js / .ts (ESM dynamic import)
 */
export interface CheckitConfig {
  /**
   * 继承的 preset 列表(按顺序叠加,后面的覆盖前面的)
   * - 字符串:"@checkit/preset-normal"
   * - 相对路径:"./.checkit/presets/my-preset.yaml"
   */
  extends?: string[];

  /**
   * 规则配置
   * key: 规则 ID 或相对路径(.ts / .yaml)
   * value: RuleConfig
   */
  rules?: Record<string, RuleConfig>;

  /**
   * 配置内 ignore(同 .checkitignore,但在 config 里)
   * 与 .checkitignore 文件叠加
   */
  ignorePatterns?: string[];

  /**
   * review 目标路径(默认 "src/")
   */
  target?: string;

  /**
   * 是否启用自动修复(默认 false)
   */
  autofix?: boolean;

  /**
   * 报告器(默认 "stylish")
   * 可选:"stylish" | "json" | "silent"
   */
  reporter?: 'stylish' | 'json' | 'silent';
}

/**
 * 解析后的内部配置(includes resolved rules)
 */
export interface ResolvedConfig {
  rules: ResolvedRuleEntry[];
  ignorePatterns: string[];
  target: string;
  autofix: boolean;
  reporter: 'stylish' | 'json' | 'silent';
}

export interface ResolvedRuleEntry {
  /**
   * 规则 ID(如 "no-console-log")或加载后的自定义规则路径
   */
  id: string;

  /**
   * 规则的实现类(可能是内置,可能是从 .ts 动态 import)
   */
  RuleCtor: new (options?: unknown) => import('@checkit/shared').ReviewRule;

  /**
   * 规则配置
   */
  config: {
    level: 'off' | 'warn' | 'error';
    type?:
      | 'structure'
      | 'traceability'
      | 'styling'
      | 'state'
      | 'documentation'
      | 'architecture'
      | 'type-safety'
      | 'security';
    options?: Record<string, unknown>;
    autofix?: boolean;
  };
}

/**
 * 内置默认配置
 */
export const DEFAULT_CONFIG: CheckitConfig = {
  rules: {},
  ignorePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  target: '.',
  autofix: false,
  reporter: 'stylish',
};
