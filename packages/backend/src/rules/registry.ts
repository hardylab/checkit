// spec:[spec](specs/backend/rules/registry.md#L1)
import { UseSpecCodingRule } from './file/use-spec-coding';
import { GroupTestFilesRule } from './file/group-test-files';
import { FilenameNamingRule } from './file/filename-naming-rule';
import { DocPatternRule } from './file/doc-pattern';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { NoAnyRule } from './ts/no-any-rule';
import { SpecTraceabilityCheckRule } from './ts/spec-traceability-check';
import { NoConsoleLogRule } from './ts/no-console-log';
import { EnvVarCheckRule } from './ts/env-var-check';
import { NoMagicNumbersRule } from './ts/no-magic-numbers';
import { FunctionSizeLimitRule } from './ts/function-size-limit';
import { NoCircularDependencyRule } from './ts/no-circular-dependency';
import { RequireTestFileRule } from './ts/require-test-file';
import { RequireIndexExportRule } from './ts/require-index-export';
import { IndexOnlyExportsRule } from './ts/index-only-exports';
import { RequireTsconfigNoEmitRule } from './ts/require-tsconfig-no-emit';
import { RequireTsconfigOneWayReferencesRule } from './ts/require-tsconfig-one-way-references';
import { Utf8EncodingRequiredRule } from './file/utf8-encoding-required';
import { TabSizeTwoSpacesRule } from './file/tab-size-two-spaces';
import { PlaintextCredentialsRule } from './ts/plaintext-credentials';
import { GitignoreSensitiveRequiredRule } from './file/gitignore-sensitive-required';
import { GitNoLargeFilesRule } from './file/git-no-large-files';
import { GitIgnoreRequiredRule } from './file/git-ignore-required';
import { GitNoSecretsInHistoryRule } from './file/git-no-secrets-in-history';
// OpenClaw 目录权限规则已迁移到独立 preset 包(@checkit/preset-openclaw),从 preset 加载
// import { OpenclawDirPermRule } from './openclaw/openclaw-dir-perm';
// import { OpenclawConfigPermRule } from './openclaw/openclaw-config-perm';
// import { OpenclawCredentialsPermRule } from './openclaw/openclaw-credentials-perm';
// import { OpenclawNoPlaintextSecretsRule } from './openclaw/openclaw-no-plaintext-secrets';
// import { OpenclawCliAvailableRule } from './openclaw/openclaw-cli-available';
// import { OpenclawSecurityAuditRule } from './openclaw/openclaw-security-audit';
import { FlowNamingRule } from './architecture/flow-naming-rule';
import { ManyConditionsRule } from './ts/many-conditions-rule';
import { RecentFilesLintFixRule } from './ts/recent-files-lint-fix';
import { RecentFilesFormatRule } from './ts/recent-files-format';
import { EntryPointNoLogicRule } from './ts/entry-point-no-logic';

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
  // OpenClaw 规则已迁移到独立 preset 包,本地不注册
  'flow-naming-rule': FlowNamingRule,
  'many-conditions-rule': ManyConditionsRule,
  'recent-files-lint-fix': RecentFilesLintFixRule,
  'recent-files-format': RecentFilesFormatRule,
  'entry-point-no-logic': EntryPointNoLogicRule,
} as const;
