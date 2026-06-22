import type { CheckitConfig } from '@checkit/cli';

const config: CheckitConfig = {
  rules: {
    // Project-local rule — path is relative to project root
    './.checkit/rules/no-lodash.ts': 'error',
  },
  ignorePatterns: ['**/node_modules/**'],
  reporter: 'stylish',
};

export default config;