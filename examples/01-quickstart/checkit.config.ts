// Project-local config — overrides defaults from @checkit/cli.
// See docs/configuration.md for the full schema.

import type { CheckitConfig } from '@checkit/cli';

const config: CheckitConfig = {
  rules: {
    'no-console-log': 'error',     // promote to error (default: warn)
    'no-any-rule': 'error',
    'require-index-export': 'warn', // we'll fix this one ourselves
  },
  ignorePatterns: ['**/node_modules/**', '**/dist/**'],
  reporter: 'stylish',
};

export default config;