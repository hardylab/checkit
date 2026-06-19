// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { describe, it, expect } from 'vitest';
import { FilenameNamingRule } from '../filename-naming-rule';
import type { RuleContext } from '@checkit/shared';

describe('filenameNamingRule', () => {
  const mockContext: RuleContext = {
    cwd: '/root',
    projectRoot: '/root',
    targetPath: '/root/src',
    targetName: 'test-project',
    targetType: 'project',
    files: [
      'components/Button.tsx',
      'components/Header.tsx',
      'utils/helper.ts',
      'utils/bad_helper.ts',
      'api/user/index.ts',
      'api/user/User.ts',
    ],
    autoFix: false,
  };

  it('should pass when no config is provided', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rule = new FilenameNamingRule(undefined as any);
    const issues = rule.check(mockContext);
    expect(issues).toHaveLength(0);
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any

  it('should enforce PascalCase for components', () => {
    const rule = new FilenameNamingRule({
      configs: [
        {
          directory: 'components',
          extensions: {
            '.tsx': 'PascalCase',
          },
        },
      ],
    });
    const issues = rule.check(mockContext);
    expect(issues).toHaveLength(0);
  });

  it('should detect snake_case violation in utils', () => {
    const rule = new FilenameNamingRule({
      configs: [
        {
          directory: 'utils',
          extensions: {
            '.ts': 'camelCase',
          },
        },
      ],
    });
    const issues = rule.check(mockContext);
    expect(issues).toHaveLength(1);
    expect(issues[0].file).toBe('utils/bad_helper.ts');
    expect(issues[0].issue).toContain('camelCase');
  });

  it('should enforce matchDirectory', () => {
    const rule = new FilenameNamingRule({
      configs: [
        {
          directory: 'api/user',
          extensions: {},
          matchDirectory: true,
        },
      ],
    });
    const issues = rule.check(mockContext);
    // api/user/index.ts -> ignored (exception)
    // api/user/User.ts -> matches directory "user"
    // dirName of 'api/user/User.ts' is 'user'. baseName is 'User'.
    // 'User' !== 'user'. So it should fail.

    expect(issues).toHaveLength(1);
    expect(issues[0].file).toBe('api/user/User.ts');
    expect(issues[0].issue).toContain("should match directory name 'user'");
  });
});
