/**
 * 共享 utils — checkit 内置规则共用
 *
 * 任何 rule 都可 import 这里。
 * 未来加新规则也用这里。
 */
import fs from 'fs';

/**
 * Windows + Git Bash 路径安全拼接
 *
 * path.join() 在 Windows 把 / 转 \,导致 fs.existsSync 找不到
 * (Windows 只认 D:/...,不认 D:\...)。
 * 这个函数保留原始分隔符(根据 targetPath 推断)。
 */
export function windowSafeJoin(targetPath: string, file: string): string {
  const sep = targetPath.includes('\\') ? '\\' : '/';
  return targetPath.replace(/[\\/]+$/, '') + sep + file.replace(/^[\\/]+/, '');
}

/**
 * 读文件内容(不存在返回空字符串)
 */
export function tryReadFile(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * 文件存在性
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}
