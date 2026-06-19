import { describe, it, expect } from 'vitest';
import { CheckitIgnore, findIgnoreFile } from './ignore';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('CheckitIgnore', () => {
  describe('基础匹配', () => {
    it('空 patterns 不忽略任何文件', () => {
      const ig = new CheckitIgnore([]);
      expect(ig.matches('src/foo.ts')).toBe(false);
      expect(ig.matches('dist/bar.js')).toBe(false);
    });

    it('简单 glob 匹配', () => {
      const ig = new CheckitIgnore(['dist/**']);
      expect(ig.matches('dist/foo.js')).toBe(true);
      expect(ig.matches('src/foo.ts')).toBe(false);
    });

    it('目录 pattern', () => {
      const ig = new CheckitIgnore(['build/']);
      expect(ig.matches('build/foo.js')).toBe(true);
      // 注意:build/ 在根目录模式不跨层,要跨层用 **/build/
    });

    it('多模式匹配', () => {
      const ig = new CheckitIgnore(['dist/**', '**/*.test.ts', 'node_modules/**']);
      expect(ig.matches('dist/foo.js')).toBe(true);
      expect(ig.matches('src/foo.test.ts')).toBe(true);
      expect(ig.matches('node_modules/react/index.js')).toBe(true);
      expect(ig.matches('src/foo.ts')).toBe(false);
    });
  });

  describe('注释和空行', () => {
    it('跳过空行', () => {
      const ig = new CheckitIgnore(['', '   ', 'dist/**']);
      expect(ig.matches('dist/foo.js')).toBe(true);
    });

    it('跳过 # 注释', () => {
      const ig = new CheckitIgnore(['# this is a comment', 'dist/**']);
      expect(ig.matches('dist/foo.js')).toBe(true);
      expect(ig.matches('# this is a comment')).toBe(false);
    });
  });

  describe('filter()', () => {
    it('过滤文件列表', () => {
      const ig = new CheckitIgnore(['dist/**', '**/*.test.ts']);
      const files = ['src/a.ts', 'dist/b.js', 'src/c.test.ts', 'lib/d.ts'];
      expect(ig.filter(files)).toEqual(['src/a.ts', 'lib/d.ts']);
    });
  });

  describe('路径规范化', () => {
    it('统一反斜杠为正斜杠', () => {
      const ig = new CheckitIgnore(['dist/**']);
      expect(ig.matches('dist\\foo.js')).toBe(true);
    });

    it('去除 ./ 前缀', () => {
      const ig = new CheckitIgnore(['dist/**']);
      expect(ig.matches('./dist/foo.js')).toBe(true);
    });
  });

  describe('withPatterns()', () => {
    it('合并现有 + 额外 patterns', () => {
      const ig1 = new CheckitIgnore(['dist/**']);
      const ig2 = ig1.withPatterns(['build/**']);
      expect(ig2.matches('dist/foo.js')).toBe(true);
      expect(ig2.matches('build/bar.js')).toBe(true);
      expect(ig2.matches('src/baz.ts')).toBe(false);
    });
  });
});

describe('findIgnoreFile', () => {
  it('在当前目录找到 .checkitignore', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'checkit-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, '.checkitignore'), 'dist/**\n');
      const result = findIgnoreFile(tmpDir);
      expect(result).toBe(path.join(tmpDir, '.checkitignore'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('父目录无 .checkitignore 时返回 null', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'checkit-test-'));
    try {
      const subDir = path.join(tmpDir, 'sub');
      fs.mkdirSync(subDir);
      const result = findIgnoreFile(subDir);
      // 找不到,返回 null(因为 tmpDir 不在 repo 内,没 .git/package.json 边界)
      // 但向上到根都没找到,所以返回 null
      expect(result).toBeNull();
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('遇到 package.json 边界停止向上', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'checkit-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
      fs.mkdirSync(path.join(tmpDir, 'sub'));
      const result = findIgnoreFile(path.join(tmpDir, 'sub'));
      expect(result).toBeNull(); // 本目录没有 .checkitignore 且遇到 package.json 边界
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});

describe('CheckitIgnore.load', () => {
  it('加载文件并应用', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'checkit-test-'));
    try {
      fs.writeFileSync(
        path.join(tmpDir, '.checkitignore'),
        '# generated\ndist/**\n\n**/*.test.ts\n'
      );
      const ig = CheckitIgnore.load(tmpDir);
      expect(ig.matches('dist/foo.js')).toBe(true);
      expect(ig.matches('src/a.test.ts')).toBe(true);
      expect(ig.matches('src/a.ts')).toBe(false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});
