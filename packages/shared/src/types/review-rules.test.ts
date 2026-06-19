import { describe, it, expect } from 'vitest';
import type { ReviewIssue, RuleContext, Paradigm } from './review-rules';

// Extend for testing purposes
declare module './review-rules' {
  interface ReviewRuleRegistry {
    'rule-1': { option: boolean };
    'rule-2': Record<string, never>;
  }
}

describe('Review Rules Types', () => {
  it('should be importable', () => {
    // Just verifying that types can be used
    const issue: ReviewIssue = {
      type: 'structure',
      module: 'test-module',
      issue: 'Test message',
      level: 'error',
    };
    expect(issue).toBeDefined();
    expect(issue.type).toBe('structure');
  });

  it('should support RuleContext', () => {
    const context: RuleContext = {
      cwd: '/test',
      projectRoot: '/root',
      targetPath: '/root/test',
      targetName: 'test',
      targetType: 'project',
      files: ['index.ts'],
      autoFix: false,
    };
    expect(context).toBeDefined();
  });

  it('should support Paradigm', () => {
    const paradigm: Paradigm = {
      name: 'test-paradigm',
      description: 'Test Paradigm',
      autofix: true,
      rules: {
        'rule-1': { options: { option: true } },
        'rule-2': {},
      },
    };
    expect(paradigm).toBeDefined();
    expect(Object.keys(paradigm.rules)).toHaveLength(2);
    expect(paradigm.rules['rule-1']).toEqual({ options: { option: true } });
  });
});
