// spec:[spec](specs/backend/rules/registry.md#L1)
import { UseSpecCodingRule } from './file/use-spec-coding/use-spec-coding.rule';
import { GroupTestFilesRule } from './file/group-test-files/group-test-files.rule';
import { FilenameNamingRule } from './file/filename-naming-rule/filename-naming-rule.rule';
import { DocPatternRule } from './file/doc-pattern/doc-pattern.rule';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { NoAnyRule } from './ts/no-any-rule/no-any-rule.rule';
import { SpecTraceabilityCheckRule } from './ts/spec-traceability-check/spec-traceability-check.rule';
import { NoConsoleLogRule } from './ts/no-console-log/no-console-log.rule';
import { EnvVarCheckRule } from './ts/env-var-check/env-var-check.rule';
import { NoMagicNumbersRule } from './ts/no-magic-numbers/no-magic-numbers.rule';
import { FunctionSizeLimitRule } from './ts/function-size-limit/function-size-limit.rule';
import { NoCircularDependencyRule } from './ts/no-circular-dependency/no-circular-dependency.rule';
import { RequireTestFileRule } from './ts/require-test-file/require-test-file.rule';
import { RequireIndexExportRule } from './ts/require-index-export/require-index-export.rule';
import { IndexOnlyExportsRule } from './ts/index-only-exports/index-only-exports.rule';
import { RequireTsconfigNoEmitRule } from './ts/require-tsconfig-no-emit/require-tsconfig-no-emit.rule';
import { RequireTsconfigOneWayReferencesRule } from './ts/require-tsconfig-one-way-references/require-tsconfig-one-way-references.rule';
import { Utf8EncodingRequiredRule } from './file/utf8-encoding-required/utf8-encoding-required.rule';
import { TabSizeTwoSpacesRule } from './file/tab-size-two-spaces/tab-size-two-spaces.rule';
import { PlaintextCredentialsRule } from './ts/plaintext-credentials/plaintext-credentials.rule';
import { GitignoreSensitiveRequiredRule } from './file/gitignore-sensitive-required/gitignore-sensitive-required.rule';
import { GitNoLargeFilesRule } from './file/git-no-large-files/git-no-large-files.rule';
import { GitIgnoreRequiredRule } from './file/git-ignore-required/git-ignore-required.rule';
import { GitNoSecretsInHistoryRule } from './file/git-no-secrets-in-history/git-no-secrets-in-history.rule';
import { OkfComplianceRule } from './file/okf-compliance/okf-compliance.rule';
import { RuleStructureRule } from './file/rule-structure/rule-structure.rule';
import { RuleSelfCheckRule } from './rule-self-check/rule-self-check.rule';
// OpenClaw 目录权限规则已迁移到独立 preset 包(@checkit/preset-openclaw),从 preset 加载
// import { OpenclawDirPermRule } from './openclaw/openclaw-dir-perm';
// import { OpenclawConfigPermRule } from './openclaw/openclaw-config-perm';
// import { OpenclawCredentialsPermRule } from './openclaw/openclaw-credentials-perm';
// import { OpenclawNoPlaintextSecretsRule } from './openclaw/openclaw-no-plaintext-secrets';
// import { OpenclawCliAvailableRule } from './openclaw/openclaw-cli-available';
// import { OpenclawSecurityAuditRule } from './openclaw/openclaw-security-audit';
import { FlowNamingRule } from './architecture/flow-naming-rule/flow-naming-rule.rule';
import { ManyConditionsRule } from './ts/many-conditions-rule/many-conditions-rule.rule';
import { RecentFilesLintFixRule } from './ts/recent-files-lint-fix/recent-files-lint-fix.rule';
import { RecentFilesFormatRule } from './ts/recent-files-format/recent-files-format.rule';
import { EntryPointNoLogicRule } from './ts/entry-point-no-logic/entry-point-no-logic.rule';

export const ruleClasses = {
  'use-spec-coding': UseSpecCodingRule,
  'group-test-files': GroupTestFilesRule,
  'filename-naming-rule': FilenameNamingRule,
  'doc-pattern': DocPatternRule,
  'no-any-rule': NoAnyRule,
  'spec-traceability-check': SpecTraceabilityCheckRule,
  'no-console-log': NoConsoleLogRule,
  'env-var-check': EnvVarCheckRule,
  'no-magic-numbers': NoMagicNumbersRule,
  'function-size-limit': FunctionSizeLimitRule,
  'no-circular-dependency': NoCircularDependencyRule,
  'require-test-file': RequireTestFileRule,
  'require-index-export': RequireIndexExportRule,
  'index-only-exports': IndexOnlyExportsRule,
  'require-tsconfig-no-emit': RequireTsconfigNoEmitRule,
  'require-tsconfig-one-way-references': RequireTsconfigOneWayReferencesRule,
  'utf8-encoding-required': Utf8EncodingRequiredRule,
  'tab-size-two-spaces': TabSizeTwoSpacesRule,
  'plaintext-credentials': PlaintextCredentialsRule,
  'gitignore-sensitive-required': GitignoreSensitiveRequiredRule,
  'git-no-large-files': GitNoLargeFilesRule,
  'git-ignore-required': GitIgnoreRequiredRule,
  'git-no-secrets-in-history': GitNoSecretsInHistoryRule,
  'okf-compliance': OkfComplianceRule,
  'rule-structure': RuleStructureRule,
  'rule-self-check': RuleSelfCheckRule,
  // OpenClaw 规则已迁移到独立 preset 包,本地不注册
  'flow-naming-rule': FlowNamingRule,
  'many-conditions-rule': ManyConditionsRule,
  'recent-files-lint-fix': RecentFilesLintFixRule,
  'recent-files-format': RecentFilesFormatRule,
  'entry-point-no-logic': EntryPointNoLogicRule,
} as const;
