import { describe, it, expect } from 'vitest';
import { mergeConfigs } from './extends';
import type { CheckitConfig } from './types';

describe('mergeConfigs', () => {
  it('空配置合并返回 override', () => {
    const override: CheckitConfig = { target: 'src' };
    expect(mergeConfigs({}, override)).toEqual({
      extends: [],
      rules: {},
      ignorePatterns: [],
      target: 'src',
      autofix: undefined,
      reporter: undefined,
    });
  });

  it('rules 合并,后者覆盖前者', () => {
    const base: CheckitConfig = {
      rules: { 'no-console-log': 'warn', 'no-any-rule': 'error' },
    };
    const override: CheckitConfig = {
      rules: { 'no-console-log': 'error', 'extra-rule': 'off' },
    };
    const merged = mergeConfigs(base, override);
    expect(merged.rules).toEqual({
      'no-console-log': 'error', // 覆盖
      'no-any-rule': 'error', // 保留
      'extra-rule': 'off', // 新增
    });
  });

  it('ignorePatterns 数组拼接', () => {
    const merged = mergeConfigs(
      { ignorePatterns: ['**/dist/**'] },
      { ignorePatterns: ['**/build/**'] }
    );
    expect(merged.ignorePatterns).toEqual(['**/dist/**', '**/build/**']);
  });

  it('extends 数组拼接', () => {
    const merged = mergeConfigs(
      { extends: ['@checkit/preset-a'] },
      { extends: ['@checkit/preset-b'] }
    );
    expect(merged.extends).toEqual(['@checkit/preset-a', '@checkit/preset-b']);
  });

  it('顶层标量字段 override 优先', () => {
    const merged = mergeConfigs(
      { target: 'lib', autofix: false, reporter: 'stylish' as const },
      { target: 'src', autofix: true }
    );
    expect(merged.target).toBe('src');
    expect(merged.autofix).toBe(true);
    expect(merged.reporter).toBe('stylish'); // override 未设,保留 base
  });
});
