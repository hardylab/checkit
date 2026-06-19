import { describe, it, expect } from 'vitest';
import { parseSimpleYaml } from './load';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('parseSimpleYaml', () => {
  it('解析简单 key:value', () => {
    const yaml = `
name: checkit
target: src
autofix: true
`;
    expect(parseSimpleYaml(yaml)).toEqual({
      name: 'checkit',
      target: 'src',
      autofix: true,
    });
  });

  it('解析数组', () => {
    const yaml = `
extends:
  - "@checkit/preset-normal"
  - "@checkit/preset-strict"
ignorePatterns:
  - "**/dist/**"
  - "**/build/**"
`;
    expect(parseSimpleYaml(yaml)).toEqual({
      extends: ['@checkit/preset-normal', '@checkit/preset-strict'],
      ignorePatterns: ['**/dist/**', '**/build/**'],
    });
  });

  it('解析嵌套对象(rules)', () => {
    const yaml = `
rules:
  no-console-log: warn
  no-any-rule:
    level: error
    options:
      strict: true
`;
    const result = parseSimpleYaml(yaml);
    expect(result).toEqual({
      rules: {
        'no-console-log': 'warn',
        'no-any-rule': {
          level: 'error',
          options: { strict: true },
        },
      },
    });
  });

  it('跳过注释和空行', () => {
    const yaml = `
# 顶层注释
name: foo

# 段落注释
target: src
`;
    expect(parseSimpleYaml(yaml)).toEqual({ name: 'foo', target: 'src' });
  });

  it('字符串引号可选', () => {
    const yaml = `
a: "quoted"
b: unquoted
c: 'single'
`;
    expect(parseSimpleYaml(yaml)).toEqual({
      a: 'quoted',
      b: 'unquoted',
      c: 'single',
    });
  });

  it('数字与布尔', () => {
    const yaml = `
n1: 42
n2: -1
n3: 3.14
b1: true
b2: false
b3: null
`;
    expect(parseSimpleYaml(yaml)).toEqual({
      n1: 42,
      n2: -1,
      n3: 3.14,
      b1: true,
      b2: false,
      b3: null,
    });
  });
});

describe('loadConfigFile', () => {
  it('加载 JSON', async () => {
    const { loadConfigFile } = await import('./load');
    const tmpFile = path.join(os.tmpdir(), 'checkit-config-test.json');
    fs.writeFileSync(
      tmpFile,
      JSON.stringify({ name: 'test', target: 'src' }, null, 2)
    );
    try {
      const cfg = await loadConfigFile(tmpFile);
      expect(cfg).toEqual({ name: 'test', target: 'src' });
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('加载 YAML', async () => {
    const { loadConfigFile } = await import('./load');
    const tmpFile = path.join(os.tmpdir(), 'checkit-config-test.yaml');
    fs.writeFileSync(
      tmpFile,
      `name: yaml-test
target: lib
rules:
  no-console-log: error
`
    );
    try {
      const cfg = await loadConfigFile(tmpFile);
      expect(cfg).toEqual({
        name: 'yaml-test',
        target: 'lib',
        rules: { 'no-console-log': 'error' },
      });
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('不支持的扩展名抛错', async () => {
    const { loadConfigFile } = await import('./load');
    const tmpFile = path.join(os.tmpdir(), 'checkit-config-test.txt');
    fs.writeFileSync(tmpFile, 'whatever');
    try {
      await expect(loadConfigFile(tmpFile)).rejects.toThrow(/Unsupported/);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});
