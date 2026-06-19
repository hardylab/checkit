// spec:[spec](specs/backend/rules/index.md#L1)

// Auto-generated barrel export — exports all rules from their folders
// 编辑此文件用 ./scripts/sync-rule-exports.sh

// file rules
export * from './file/doc-pattern/doc-pattern.rule';
export * from './file/filename-naming-rule/filename-naming-rule.rule';
export * from './file/git-ignore-required/git-ignore-required.rule';
export * from './file/git-no-large-files/git-no-large-files.rule';
export * from './file/git-no-secrets-in-history/git-no-secrets-in-history.rule';
export * from './file/gitignore-sensitive-required/gitignore-sensitive-required.rule';
export * from './file/group-test-files/group-test-files.rule';
export * from './file/tab-size-two-spaces/tab-size-two-spaces.rule';
export * from './file/utf8-encoding-required/utf8-encoding-required.rule';
export * from './file/use-spec-coding/use-spec-coding.rule';

// ts rules
export * from './ts/entry-point-no-logic/entry-point-no-logic.rule';
export * from './ts/env-var-check/env-var-check.rule';
export * from './ts/function-size-limit/function-size-limit.rule';
export * from './ts/index-only-exports/index-only-exports.rule';
export * from './ts/many-conditions-rule/many-conditions-rule.rule';
export * from './ts/no-any-rule/no-any-rule.rule';
export * from './ts/no-circular-dependency/no-circular-dependency.rule';
export * from './ts/no-console-log/no-console-log.rule';
export * from './ts/no-magic-numbers/no-magic-numbers.rule';
export * from './ts/plaintext-credentials/plaintext-credentials.rule';
export * from './ts/recent-files-format/recent-files-format.rule';
export * from './ts/recent-files-lint-fix/recent-files-lint-fix.rule';
export * from './ts/require-index-export/require-index-export.rule';
export * from './ts/require-test-file/require-test-file.rule';
export * from './ts/require-tsconfig-no-emit/require-tsconfig-no-emit.rule';
export * from './ts/require-tsconfig-one-way-references/require-tsconfig-one-way-references.rule';
export * from './ts/spec-traceability-check/spec-traceability-check.rule';

// architecture rules
export * from './architecture/flow-naming-rule/flow-naming-rule.rule';

// OpenClaw 规则已迁移到独立 preset 包(@checkit/preset-openclaw),从 preset 加载
// import { OpenclawDirPermRule } from './openclaw/openclaw-dir-perm';
// ... (略)

// registry
export * from './registry';
