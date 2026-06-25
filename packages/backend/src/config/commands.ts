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

import fs from 'node:fs';
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
    // Distinguish "no config file" vs "empty config file" — both are valid
    // (unsetConfig leaves {} on disk for atomic-write safety).
    if (!fs.existsSync(configFilePath())) {
      console.log(`(empty — ${configFilePath()} does not exist yet)`);
    } else {
      console.log(`${configFilePath()}`);
      console.log('  (no keys set)');
    }
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
// ─────────────────────────────────────────────────────────
// config test — verify the configured LLM is reachable + authenticated.
// Sends a short "ping" message and reports the adapter + reply status.
// Used by desktop SettingsModal to refuse saves that point at a broken
// provider (wrong key, bad URL, 401, network down, etc.).
// ─────────────────────────────────────────────────────────
export async function cmdConfigTest(args: string[], cwd: string): Promise<void> {
  const asJson = hasFlag(args, '--json');
  const adapter = getConfig('ai.adapter').value ?? 'local-keyword';
  const model = getConfig('ai.model').value as string | undefined;
  const baseUrl = getConfig('ai.base_url').value as string | undefined;
  const apiKey = getConfig('ai.api_key').value as string | undefined;

  // local-keyword is trivially "reachable" — no LLM call.
  if (adapter === 'local-keyword') {
    const out = {
      ok: true,
      adapter,
      model: model ?? '(no LLM)',
      reply: 'local-keyword: offline, no LLM call',
      replyLength: 0,
    };
    if (asJson) {
      console.log(JSON.stringify(out, null, 2));
    } else {
      console.log(`✓ ${out.adapter}: ${out.reply}`);
    }
    return;
  }

  // Build a fresh adapter and ping it. We do NOT use the registry's auto-
  // promote-from-env logic — the user just saved this config, we want to
  // verify *this* config, not whatever env var is in scope.
  let pingResult;
  try {
    const { makeOpenAIAdapter } = await import('../ai-adapter/openai.js');
    const { makeClaudeAdapter } = await import('../ai-adapter/claude.js');
    let adapterInstance;
    if (adapter === 'claude') {
      adapterInstance = makeClaudeAdapter({ apiKey, model, baseUrl });
    } else {
      // openai / minimax / custom / ollama — all OpenAI-compatible.
      adapterInstance = makeOpenAIAdapter({ apiKey, model, baseUrl });
    }
    pingResult = await adapterInstance.chat('Reply with the single word: pong', { cwd });
  } catch (e) {
    const out = {
      ok: false,
      adapter,
      model: model ?? null,
      baseUrl: baseUrl ?? null,
      error: (e as Error).message,
    };
    if (asJson) {
      console.log(JSON.stringify(out, null, 2));
    } else {
      console.error(`✗ ${adapter}: ${out.error}`);
    }
    if (asJson) process.exit(1);
    die(`${adapter}: ${out.error}`);
  }

  // The LLM call succeeded. Use reply length as a sanity check — an empty
  // reply or a 1-char echo suggests the model is misconfigured.
  const reply = pingResult.reply ?? '';
  const replyLength = reply.trim().length;
  const ok = replyLength > 0;
  const out = {
    ok,
    adapter,
    model: model ?? null,
    baseUrl: baseUrl ?? null,
    reply,
    replyLength,
    ...(ok ? {} : { warning: 'empty reply — provider returned nothing' }),
  };
  if (asJson) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    if (ok) {
      console.log(`✓ ${adapter} (${out.model ?? 'default model'}): ${reply.slice(0, 80)}${reply.length > 80 ? '…' : ''}`);
    } else {
      console.error(`⚠ ${adapter}: empty reply`);
    }
  }
  if (!ok) process.exit(1);
}

// dispatch
// ─────────────────────────────────────────────────────────
export const CONFIG_COMMANDS = {
  set: cmdConfigSet,
  get: cmdConfigGet,
  list: cmdConfigList,
  unset: cmdConfigUnset,
  test: cmdConfigTest,
} as const;

export type ConfigCommandName = keyof typeof CONFIG_COMMANDS;
