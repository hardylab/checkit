// spec:[spec](specs/backend/paradigms/dev.md)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { Paradigm } from '@checkit/shared';

/**
 * dev paradigm — checkit 自检用
 *
 * 设计原则:
 * - 只装 3 个 meta-rule(rule-self-check + rule-structure + okf-compliance)
 * - 强制 error 级别(违反 = 阻塞开发模式)
 * - 不装任何项目级 rule(命名 / 缩进 / 测试)—— 这些不是 checkit 自身的"自检契约"
 *
 * 触发方式:CLI 加 --dev flag,自动加载
 *
 * 区别于 normalParadigm:
 * - normalParadigm 是"用户项目用什么规则"
 * - devParadigm 是"checkit 自己必须满足什么规则"
 *
 * 5 步闭环:checkit 自己是 Codebase Doctor,自己必须先健康。
 */
export const devParadigm: Paradigm = {
  name: 'dev',
  description: 'CheckIt self-check — verifies that every built-in rule has docs + implements ReviewRule + OKF-compliant frontmatter',
  autofix: true,
  rules: {
    /**
     * 强制:每个 <name>.rule.ts 必须有 <name>.md
     * 目的:规则商城展示 + Obsidian wiki 链接 + AI agent 消费
     */
    'rule-self-check': { issue: 'error', options: {} },

    /**
     * 强制:每个 rule 必须 implements ReviewRule + 有 fix() 方法
     * 目的:checkit 的 5 步闭环契约(detect → explain → fix → verify → learn)
     */
    'rule-structure': { issue: 'error', options: {} },

    /**
     * 强制:每个 .md 都有 OKF v0.1 frontmatter(type + title + timestamp)
     * 目的:AI agent 可直接消费
     */
    'okf-compliance': { issue: 'warning', options: {} },
  },
};