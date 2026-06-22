import type { CheckitConfig } from '@checkit/cli';

const config: CheckitConfig = {
  rules: {
    'no-console-log': 'error',
    'no-any-rule': 'error',
  },
  ignorePatterns: ['**/node_modules/**'],
  reporter: 'stylish',
};

export default config;