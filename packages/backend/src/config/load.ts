/**
 * 配置加载器
 *
 * 支持格式:
 * - checkit.config.json  → JSON.parse
 * - checkit.config.yaml / .yml → mini YAML parser
 * - checkit.config.js / .ts → dynamic import
 */

import fs from 'fs';
import path from 'path';
import type { CheckitConfig } from './types';

/**
 * 加载配置文件(根据扩展名分发)
 */
export async function loadConfigFile(configPath: string): Promise<CheckitConfig> {
  const ext = path.extname(configPath).toLowerCase();
  const content = fs.readFileSync(configPath, 'utf-8');

  switch (ext) {
    case '.json':
      return JSON.parse(content) as CheckitConfig;
    case '.yaml':
    case '.yml':
      return parseSimpleYaml(content);
    case '.js':
    case '.ts': {
      const mod = await import(pathToFileUrl(configPath));
      const config = mod.default ?? mod;
      return config as CheckitConfig;
    }
    default:
      throw new Error(`Unsupported config file extension: ${ext}`);
  }
}

function pathToFileUrl(p: string): string {
  const normalized = p.replace(/\\/g, '/');
  if (normalized.startsWith('/')) {
    return 'file://' + normalized;
  }
  return 'file:///' + normalized;
}

/**
 * Mini YAML 解析(checkit 配置用)
 *
 * 支持:
 * - key: value
 * - 字符串(带/不带引号)
 * - 数组(- item)
 * - 注释(#)
 * - 嵌套(2 空格缩进)
 */
export function parseSimpleYaml(text: string): CheckitConfig {
  // 预处理:删注释 + 删空行(保留行号结构,但用空行占位)
  const rawLines = text.split(/\r?\n/);
  const lines: Array<{ indent: number; content: string }> = [];
  for (const raw of rawLines) {
    // 行内注释:去掉 # 后的内容(但 # 在引号内不算)
    const stripped = stripInlineComment(raw);
    if (!stripped.trim()) continue;
    const indent = stripped.match(/^(\s*)/)?.[1].length ?? 0;
    const content = stripped.trim();
    lines.push({ indent, content });
  }

  type StackFrame = { indent: number; container: Record<string, unknown> | unknown[]; isArray: boolean };
  const root: Record<string, unknown> = {};
  const stack: StackFrame[] = [{ indent: -1, container: root, isArray: false }];

  for (const { indent, content } of lines) {
    // 弹栈直到栈顶 indent < 当前 indent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const top = stack[stack.length - 1];

    if (content.startsWith('- ')) {
      // 数组项
      // 如果栈顶不是数组,把它升级为数组(覆盖之前的 {} 空容器)
      if (!top.isArray) {
        const arr: unknown[] = [];
        // 找到 top.container 在父容器中的引用,替换为 arr
        // 简化处理:仅当 top 是 {} 空对象时替换
        if (
          top.container &&
          typeof top.container === 'object' &&
          !Array.isArray(top.container) &&
          Object.keys(top.container as Record<string, unknown>).length === 0
        ) {
          // 找到父栈帧,把对 top.container 的引用替换为 arr
          const parent = stack.length >= 2 ? stack[stack.length - 2] : null;
          if (parent && !parent.isArray) {
            const parentObj = parent.container as Record<string, unknown>;
            for (const k of Object.keys(parentObj)) {
              if (parentObj[k] === top.container) {
                parentObj[k] = arr;
                top.container = arr;
                top.isArray = true;
                break;
              }
            }
          }
        }
        if (!top.isArray) continue;
      }
      const value = parseValue(content.slice(2).trim());
      (top.container as unknown[]).push(value);
    } else {
      // key: value
      const m = content.match(/^([\w-]+)\s*:\s*(.*)$/);
      if (!m) continue;
      const [, key, rawValue] = m;
      const value = parseValue(rawValue.trim());

      if (top.isArray) {
        // 在数组上下文 → 不应有 key: value,跳过
        continue;
      }

      const obj = top.container as Record<string, unknown>;

      if (Array.isArray(value)) {
        obj[key] = value;
        stack.push({ indent, container: value as unknown[], isArray: true });
      } else if (value && typeof value === 'object') {
        obj[key] = value;
        stack.push({ indent, container: value as Record<string, unknown>, isArray: false });
      } else if (rawValue === '' || value === undefined) {
        // 真正空的 value(如 "rules:")→ 创建空容器,等下一行决定类型
        // 但要区分:b3: null 是显式 null,不是空
        const child: Record<string, unknown> = {};
        obj[key] = child;
        stack.push({ indent, container: child, isArray: false });
      } else {
        // 标量值(含 null / 数字 / 布尔)
        obj[key] = value;
      }
    }
  }

  return root as CheckitConfig;
}

function parseValue(raw: string): unknown {
  if (!raw) return null;
  if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
  if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1);

  if (raw.startsWith('[') && raw.endsWith(']')) {
    const inner = raw.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((s) => parseScalar(s.trim()));
  }

  if (raw.startsWith('{') && raw.endsWith('}')) {
    return parseInlineObject(raw);
  }

  return parseScalar(raw);
}

function parseScalar(s: string): unknown {
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '~') return null;
  if (/^-?\d+$/.test(s)) return Number(s);
  if (/^-?\d+\.\d+$/.test(s)) return Number(s);
  return s;
}

function parseInlineObject(text: string): Record<string, unknown> {
  const inner = text.slice(1, -1).trim();
  if (!inner) return {};
  const obj: Record<string, unknown> = {};
  for (const part of inner.split(',')) {
    const m = part.trim().match(/^([\w-]+)\s*:\s*(.*)$/);
    if (m) {
      const [, k, v] = m;
      obj[k] = parseScalar(v.trim());
    }
  }
  return obj;
}

/**
 * 去掉行内注释(简化版:# 必须在非引号位置)
 * 完整的引号处理太复杂,YAML 配置文件里几乎不会出现 # 在引号内
 */
function stripInlineComment(line: string): string {
  // 跳过引号内的 #
  let inDouble = false;
  let inSingle = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '#' && !inDouble && !inSingle) {
      // 检查 # 前面是否有非空白字符(否则是行首注释,已经被前面的 trim 处理)
      const before = line.slice(0, i).trim();
      if (before) return line.slice(0, i);
      else return line;
    }
  }
  return line;
}
