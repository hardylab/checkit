import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { findConfigFile, resolveExplicitConfig } from './find';

describe('findConfigFile', () => {
  let tmpDir: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // 创建临时目录模拟项目根
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'checkit-find-test-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    cwdSpy.mockRestore();
  });

  it('从 cwd 找到 checkit.config.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'checkit.config.json'), '{}');
    expect(findConfigFile(tmpDir)).toBe(path.join(tmpDir, 'checkit.config.json'));
  });

  it('从 cwd 找到 default.config.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'default.config.json'), '{}');
    expect(findConfigFile(tmpDir)).toBe(path.join(tmpDir, 'default.config.json'));
  });

  it('checkit.config 优先于 default.config', () => {
    fs.writeFileSync(path.join(tmpDir, 'checkit.config.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'default.config.json'), '{}');
    expect(findConfigFile(tmpDir)).toBe(path.join(tmpDir, 'checkit.config.json'));
  });

  it('支持多种扩展名', () => {
    for (const ext of ['.js', '.ts', '.json', '.yaml', '.yml']) {
      const sub = fs.mkdtempSync(path.join(tmpDir, `ext-${ext}-`));
      fs.writeFileSync(path.join(sub, 'checkit.config' + ext), '{}');
      expect(findConfigFile(sub)).toBe(path.join(sub, 'checkit.config' + ext));
      fs.rmSync(sub, { recursive: true, force: true });
    }
  });

  it('default.config 也支持多种扩展名', () => {
    for (const ext of ['.js', '.ts', '.json', '.yaml', '.yml']) {
      const sub = fs.mkdtempSync(path.join(tmpDir, `default-ext-${ext}-`));
      fs.writeFileSync(path.join(sub, 'default.config' + ext), '{}');
      expect(findConfigFile(sub)).toBe(path.join(sub, 'default.config' + ext));
      fs.rmSync(sub, { recursive: true, force: true });
    }
  });

  it('从子目录向上找到父目录的 config', () => {
    fs.writeFileSync(path.join(tmpDir, 'checkit.config.json'), '{}');
    const sub = path.join(tmpDir, 'packages', 'kernel');
    fs.mkdirSync(sub, { recursive: true });
    // 不能用 .git / package.json 阻断,所以在 tmpDir 下不加这些
    expect(findConfigFile(sub)).toBe(path.join(tmpDir, 'checkit.config.json'));
  });

  it('遇到 package.json 停止向上查找', () => {
    const sub = path.join(tmpDir, 'packages', 'kernel');
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(sub, 'package.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'checkit.config.json'), '{}');
    // sub 有 package.json,就是 repo 边界,停止向上
    expect(findConfigFile(sub)).toBeNull();
  });

  it('遇到 .git 停止向上查找', () => {
    const sub = path.join(tmpDir, 'packages', 'kernel');
    fs.mkdirSync(path.join(sub, '.git'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'checkit.config.json'), '{}');
    expect(findConfigFile(sub)).toBeNull();
  });

  it('没有 config 返回 null', () => {
    expect(findConfigFile(tmpDir)).toBeNull();
  });

  describe('resolveExplicitConfig 短名', () => {
    it('--config strict 找 .checkit/strict.config.json', () => {
      fs.mkdirSync(path.join(tmpDir, '.checkit'));
      fs.writeFileSync(path.join(tmpDir, '.checkit', 'strict.config.json'), '{}');
      expect(resolveExplicitConfig('strict', tmpDir)).toBe(
        path.join(tmpDir, '.checkit', 'strict.config.json')
      );
    });

    it('--config legacy 找项目根平铺', () => {
      fs.writeFileSync(path.join(tmpDir, 'legacy.config.json'), '{}');
      expect(resolveExplicitConfig('legacy', tmpDir)).toBe(
        path.join(tmpDir, 'legacy.config.json')
      );
    });

    it('--config x 找 ./x.{ext} 短名', () => {
      fs.writeFileSync(path.join(tmpDir, 'x.json'), '{}');
      expect(resolveExplicitConfig('x', tmpDir)).toBe(path.join(tmpDir, 'x.json'));
    });

    it('完整路径仍工作', () => {
      const configPath = path.join(tmpDir, 'my-checkit.config.json');
      fs.writeFileSync(configPath, '{}');
      expect(resolveExplicitConfig(configPath, tmpDir)).toBe(configPath);
    });

    it('短名找不到报错(列出尝试的路径)', () => {
      expect(() => resolveExplicitConfig('nonexistent', tmpDir)).toThrow(/not found/);
    });
  });

  describe('.checkit/ 私有目录', () => {
    it('优先从 .checkit/ 子目录找', () => {
      fs.mkdirSync(path.join(tmpDir, '.checkit'));
      fs.writeFileSync(path.join(tmpDir, 'checkit.config.json'), '{}');
      fs.writeFileSync(path.join(tmpDir, '.checkit', 'checkit.config.json'), '{}');
      const found = findConfigFile(tmpDir);
      expect(found).toBe(path.join(tmpDir, '.checkit', 'checkit.config.json'));
    });

    it('.checkit/default.config.json 也支持', () => {
      fs.mkdirSync(path.join(tmpDir, '.checkit'));
      fs.writeFileSync(path.join(tmpDir, '.checkit', 'default.config.json'), '{}');
      expect(findConfigFile(tmpDir)).toBe(path.join(tmpDir, '.checkit', 'default.config.json'));
    });

    it('.checkit/ 内 checkit.config 优先于 default.config', () => {
      fs.mkdirSync(path.join(tmpDir, '.checkit'));
      fs.writeFileSync(path.join(tmpDir, '.checkit', 'checkit.config.json'), '{}');
      fs.writeFileSync(path.join(tmpDir, '.checkit', 'default.config.json'), '{}');
      expect(findConfigFile(tmpDir)).toBe(path.join(tmpDir, '.checkit', 'checkit.config.json'));
    });

    it('从子目录向上找到 .checkit/config', () => {
      fs.mkdirSync(path.join(tmpDir, '.checkit'));
      fs.writeFileSync(path.join(tmpDir, '.checkit', 'checkit.config.json'), '{}');
      const sub = path.join(tmpDir, 'packages', 'kernel', 'src');
      fs.mkdirSync(sub, { recursive: true });
      expect(findConfigFile(sub)).toBe(path.join(tmpDir, '.checkit', 'checkit.config.json'));
    });

    it('.checkit/ 内多种扩展名都支持', () => {
      for (const ext of ['.js', '.ts', '.json', '.yaml', '.yml']) {
        const sub = fs.mkdtempSync(path.join(tmpDir, `private-ext-${ext}-`));
        fs.mkdirSync(path.join(sub, '.checkit'));
        fs.writeFileSync(path.join(sub, '.checkit', 'checkit.config' + ext), '{}');
        expect(findConfigFile(sub)).toBe(path.join(sub, '.checkit', 'checkit.config' + ext));
        fs.rmSync(sub, { recursive: true, force: true });
      }
    });

    it('.checkit/ 没 config 时回退到平铺', () => {
      fs.mkdirSync(path.join(tmpDir, '.checkit'));
      // .checkit/ 里没 config
      fs.writeFileSync(path.join(tmpDir, 'checkit.config.json'), '{}');
      expect(findConfigFile(tmpDir)).toBe(path.join(tmpDir, 'checkit.config.json'));
    });
  });
});
