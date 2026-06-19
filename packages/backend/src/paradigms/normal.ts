// spec:[spec](specs/backend/paradigms/normal.md)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { Paradigm } from '@checkit/shared';

export const normalParadigm: Paradigm = {
  name: 'normal',
  description: 'Standard coding paradigm with basic structural checks',
  autofix: true,
  rules: {
    'group-test-files': { issue: 'warning', options: {} },
    'use-spec-coding': { issue: 'warning', options: {} },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    'no-any-rule': { issue: 'warning', options: {} },
    'spec-traceability-check': {
      issue: 'warning',
      options: {
        directories: ['controllers', 'services', 'rules'],
        keywords: ['class', 'function'],
        timeWindowMinutes: 12 * 60,
      },
    },
    'no-console-log': { issue: 'warning', options: {} },
    'env-var-check': { issue: 'warning', options: {} },
    'no-magic-numbers': { issue: 'warning', options: { allow: [0, 1, -1, 2, 4, 8, 9, 42, 200] } },
    'function-size-limit': { issue: 'warning', options: { maxLines: 200 } },
    'many-conditions-rule': { issue: 'warning', options: { maxBranches: 6 } },
    'recent-files-lint-fix': { issue: 'warning', options: { timeWindowMinutes: 60 } },
    'recent-files-format': { issue: 'warning', options: { timeWindowMinutes: 60 } },
    'entry-point-no-logic': { issue: 'error', options: { files: ['main.ts'] } },
    'no-circular-dependency': { issue: 'warning', options: {} },
    'require-test-file': { issue: 'error', options: {} },
    'require-index-export': { issue: 'error', options: {} },
    'index-only-exports': { issue: 'warning', options: {} },
    'require-tsconfig-no-emit': { issue: 'error', options: {} },
    'require-tsconfig-one-way-references': { issue: 'error', options: {} },
    'utf8-encoding-required': { issue: 'error', options: { allowBom: false } },
    'tab-size-two-spaces': {
      issue: 'error',
      options: {
        includeExtensions: ['ts', 'tsx', 'css', 'less', 'yaml', 'yml', 'json'],
      },
    },
    'flow-naming-rule': { issue: 'error', options: {} },
    'filename-naming-rule': {
      issue: 'warning',
      options: {
        configs: [
          {
            directory: '.',
            extensions: {
              '.ts': 'kebab-case',
            },
          },
        ],
      },
    },
  },
};
