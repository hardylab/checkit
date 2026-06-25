// packages/backend/src/custom-provider/commands.ts — CLI subcommands for custom providers.
//
// 3 subcommands: list / add / remove.
//   lintany custom-provider list
//   lintany custom-provider add <id> --name <display name> --base-url <url> --default-model <m>
//   lintany custom-provider remove <id>

import fs from 'node:fs';
import {
  listCustomProviders,
  readCustomProvider,
  writeCustomProvider,
  deleteCustomProvider,
  slugify,
} from './store.js';

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}
function flagValue(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return undefined;
  return args[i + 1];
}
function die(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}
function dieUsage(msg: string): never {
  console.error(`error: ${msg}\n  usage: lintany custom-provider <list|add|remove> [opts]`);
  process.exit(1);
}
function positional(args: string[]): string[] {
  // The 'add' subcommand wants <id> as first positional; everything after
  // is consumed via flags. For list/remove, all positional are ids.
  return args.filter((a) => !a.startsWith('--'));
}

export function cmdCustomProviderList(args: string[], _cwd: string): void {
  const asJson = hasFlag(args, '--json');
  const providers = listCustomProviders();
  if (asJson) {
    console.log(JSON.stringify({ providers }, null, 2));
  } else if (providers.length === 0) {
    console.log('(no custom providers — use `lintany custom-provider add <id> ...`)');
  } else {
    for (const p of providers) {
      console.log(`  ${p.id.padEnd(20)}  ${p.name}  (baseUrl: ${p.baseUrl}, default: ${p.defaultModel})`);
    }
  }
}

export function cmdCustomProviderAdd(args: string[], _cwd: string): void {
  const asJson = hasFlag(args, '--json');
  const pos = positional(args);
  const rawId = pos[0];
  if (!rawId) dieUsage('add requires <id>');
  const id = slugify(rawId);
  if (!id) dieUsage(`<id> must contain at least one alphanumeric char (got "${rawId}")`);

  const name = flagValue(args, '--name') ?? rawId;
  const baseUrl = flagValue(args, '--base-url') ?? '';
  const defaultModel = flagValue(args, '--default-model') ?? '';

  if (!baseUrl) dieUsage('--base-url is required (OpenAI-compatible endpoint)');

  const record = writeCustomProvider({ id, name, baseUrl, defaultModel });
  if (asJson) {
    console.log(JSON.stringify({ ok: true, provider: record }, null, 2));
  } else {
    console.log(`✓ added custom provider: ${record.id} (${record.name})`);
    console.log(`  file: ${require('node:path').join(process.env.HOME ?? require('node:os').homedir(), '.checkit', 'custom-providers', `${record.id}.json`)}`);
  }
}

export function cmdCustomProviderRemove(args: string[], _cwd: string): void {
  const asJson = hasFlag(args, '--json');
  const pos = positional(args);
  const id = pos[0];
  if (!id) dieUsage('remove requires <id>');
  const removed = deleteCustomProvider(id);
  if (asJson) {
    console.log(JSON.stringify({ ok: removed, id }, null, 2));
  } else if (removed) {
    console.log(`✓ removed custom provider: ${id}`);
  } else {
    console.error(`✗ custom provider "${id}" not found`);
    process.exit(1);
  }
}

/** Read a single custom provider by id. Returns null if missing. */
export function cmdCustomProviderShow(args: string[], _cwd: string): void {
  const asJson = hasFlag(args, '--json');
  const pos = positional(args);
  const id = pos[0];
  if (!id) dieUsage('show requires <id>');
  const p = readCustomProvider(id);
  if (asJson) {
    console.log(JSON.stringify({ found: !!p, provider: p }, null, 2));
  } else if (p) {
    console.log(JSON.stringify(p, null, 2));
  } else {
    console.error(`✗ custom provider "${id}" not found`);
    process.exit(1);
  }
}

export const CUSTOM_PROVIDER_COMMANDS = {
  list: cmdCustomProviderList,
  add: cmdCustomProviderAdd,
  remove: cmdCustomProviderRemove,
  show: cmdCustomProviderShow,
  // alias
  rm: cmdCustomProviderRemove,
} as const;
