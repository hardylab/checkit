// packages/backend/src/config/commands.ts — global config CLI subcommands
//
// 4 子命令: set / get / list / unset
// 走 ~/.checkit/config.json(per MSP C4 全局层)。
// 用法示例:
//   lintany config set ai.adapter openai
//   lintany config set theme dark
//   lintany config set locale zh-CN
//   lintany config set ai.api_key sk-xxx     # 注:实际密钥建议走 keyring/env,这里只存 ref
//   lintany config get ai.adapter
//   lintany config list
//   lintany config unset ai.adapter

import {
  setConfig,
  getConfig,
  listConfig,
  unsetConfig,
  parseKey,
  parseValue,
  formatValue,
  configFilePath,
} from './global.js';

function die(msg: string, code = 1): never {
  console.error(`error: ${msg}`);
  process.exit(code);
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : '';
}

function positional(args: string[]): string[] {
  return args.filter((a) => !a.startsWith('--'));
}

// ─────────────────────────────────────────────────────────
// config set <key> <value>  [--json]
// ─────────────────────────────────────────────────────────
export function cmdConfigSet(args: string[], _cwd: string): void {
  const pos = positional(args);
  const key = pos[0];
  if (!key) die('config set: <key> <value> required\n  usage: lintany config set <key> <value>');

  // value: next positional, OR --value/-v flag, OR joined remaining args
  let raw: string | undefined = pos[1];
  if (raw === undefined) raw = flag(args, '--value') ?? flag(args, '-v');
  if (raw === undefined) die(`config set: <value> required after key "${key}"`);

  const value = parseValue(raw);
  try {
    setConfig(key, value);
  } catch (e) {
    die((e as Error).message);
  }

  if (hasFlag(args, '--json')) {
    console.log(JSON.stringify({ key, value, file: configFilePath() }, null, 2));
  } else {
    console.log(`✓ ${key} = ${formatValue(value)}`);
  }
}

// ─────────────────────────────────────────────────────────
// config get <key>  [--json]
// ─────────────────────────────────────────────────────────
export function cmdConfigGet(args: string[], _cwd: string): void {
  const pos = positional(args);
  const key = pos[0];
  if (!key) die('config get: <key> required');

  const { value, found } = getConfig(key);
  if (!found) {
    if (hasFlag(args, '--json')) {
      console.log(JSON.stringify({ key, found: false, value: null }, null, 2));
      process.exit(0);
    }
    die(`key "${key}" not set (run "lintany config set ${key} <value>" first)`);
  }
  if (hasFlag(args, '--json')) {
    console.log(JSON.stringify({ key, found: true, value }, null, 2));
  } else {
    console.log(formatValue(value as any));
  }
}

// ─────────────────────────────────────────────────────────
// config list [--json]
// ─────────────────────────────────────────────────────────
export function cmdConfigList(args: string[], _cwd: string): void {
  const keys = listConfig();
  if (hasFlag(args, '--json')) {
    console.log(JSON.stringify({ keys, file: configFilePath() }, null, 2));
    return;
  }
  if (keys.length === 0) {
    console.log(`(empty — ${configFilePath()} does not exist yet)`);
    return;
  }
  console.log(`${configFilePath()}`);
  const longest = Math.max(...keys.map((k) => k.length));
  for (const k of keys) {
    const { value } = getConfig(k);
    console.log(`  ${k.padEnd(longest + 2)} ${formatValue(value as any)}`);
  }
}

// ─────────────────────────────────────────────────────────
// config unset <key>
// ─────────────────────────────────────────────────────────
export function cmdConfigUnset(args: string[], _cwd: string): void {
  const pos = positional(args);
  const key = pos[0];
  if (!key) die('config unset: <key> required');

  const removed = unsetConfig(key);
  if (!removed) {
    die(`key "${key}" was not set (nothing to unset)`);
  }
  console.log(`✓ Removed "${key}"`);
}

// ─────────────────────────────────────────────────────────
// dispatch
// ─────────────────────────────────────────────────────────
export const CONFIG_COMMANDS = {
  set: cmdConfigSet,
  get: cmdConfigGet,
  list: cmdConfigList,
  unset: cmdConfigUnset,
} as const;

export type ConfigCommandName = keyof typeof CONFIG_COMMANDS;
