// packages/backend/src/preset/commands.ts — 6 preset subcommand implementations
//
// 命名约定:每个 command 接收 (args: string[], cwd: string) → void
// 输出用 console.log / console.error,exit code 通过 process.exit 控制。
//
// 子命令清单(per MSP 第 4 节):
//   list / new / show / apply / export / import
//
// 不在此处输出 rich TUI(后续 Phase 3 用 drawer 接管)。

import fs from 'node:fs';
import path from 'node:path';
import {
  listPresets,
  readPreset,
  writePreset,
  deletePreset,
  applyPreset,
  exportPreset,
  importPreset,
  presetDirHint,
  hasPreset,
  type PresetScope,
} from './store.js';
import type { Preset, PresetRuleConfig } from './schema.js';

/** Parse a flag value or undefined if absent. */
function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : '';
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function resolveScope(args: string[]): PresetScope {
  if (hasFlag(args, '--global')) return 'global';
  return 'project';
}

function die(msg: string, code = 1): never {
  console.error(`error: ${msg}`);
  process.exit(code);
}

// ─────────────────────────────────────────────────────────
// preset list [--scope project|global] [--json]
// ─────────────────────────────────────────────────────────
export function cmdPresetList(args: string[], cwd: string): void {
  const scopeArg = flag(args, '--scope');
  const asJson = hasFlag(args, '--json');
  const showBoth = scopeArg === undefined && !hasFlag(args, '--global');

  const collect = (s: PresetScope) => listPresets(s, cwd);

  let projectList = showBoth || scopeArg === 'project' || scopeArg === undefined ? collect('project') : [];
  let globalList = showBoth ? collect('global') : [];

  if (asJson) {
    console.log(JSON.stringify({ project: projectList, global: globalList }, null, 2));
    return;
  }

  if (!showBoth) {
    const scope: PresetScope = resolveScope(args);
    if (scope === 'global') {
      projectList = [];
      globalList = collect('global');
    } else {
      projectList = collect('project');
      globalList = [];
    }
  }

  const printSection = (label: string, dir: string, entries: typeof projectList) => {
    console.log(`\n${label} (${dir})`);
    console.log('-'.repeat(label.length + dir.length + 3));
    if (entries.length === 0) {
      console.log('  (none)');
      return;
    }
    for (const e of entries) {
      const src = `[${e.source}]`.padEnd(16);
      console.log(`  ${e.id.padEnd(32)} ${src} ${e.rule_count} rules  ${e.name}`);
    }
  };

  if (showBoth) {
    printSection('project', presetDirHint('project', cwd), projectList);
    printSection('global', presetDirHint('global'), globalList);
  } else {
    const scope: PresetScope = resolveScope(args);
    const entries = scope === 'global' ? globalList : projectList;
    printSection(scope, presetDirHint(scope, cwd), entries);
  }
}

// ─────────────────────────────────────────────────────────
// preset new <name> [--id <id>] [--rules <ids>] [--from-last-chat]
//                   [--scope project|global] [--json]
// ─────────────────────────────────────────────────────────
export async function cmdPresetNew(args: string[], cwd: string): Promise<void> {
  // positional: first non-flag is the name
  const positional = args.filter((a) => !a.startsWith('--'));
  const name = positional[0];
  if (!name) die('preset new: <name> required\n  usage: <brand> preset new <name> [--id <id>] [--rules <ids>] [--scope project|global]');

  const explicitId = flag(args, '--id');
  const rulesCsv = flag(args, '--rules');
  const fromLastChat = hasFlag(args, '--from-last-chat');
  const asJson = hasFlag(args, '--json');

  const id = explicitId ?? slugifyId(name);
  const scope = resolveScope(args);

  if (hasPreset(id, scope, cwd)) {
    die(`preset "${id}" already exists in ${scope}. Use a different --id or delete it first.`);
  }

  // Resolve rules
  let rules: PresetRuleConfig[] = [];
  if (rulesCsv) {
    rules = rulesCsv.split(',').map((s) => s.trim()).filter(Boolean).map((rid) => ({ id: rid }));
  } else if (fromLastChat) {
    // TODO Phase 1.5: read from checkit:last-chat-history sidecar
    console.warn('warning: --from-last-chat not yet implemented (Phase 1.5). Creating empty preset.');
  }

  const now = new Date().toISOString();
  const preset: Preset = {
    id,
    name,
    description: '',
    version: '1.0',
    source: 'manual',
    rules,
    metadata: {
      created_at: now,
      updated_at: now,
      created_from: fromLastChat ? 'chat' : 'cli',
    },
  };

  const { path: fp } = writePreset(preset, { scope, cwd });

  if (asJson) {
    console.log(JSON.stringify({ id, path: fp, scope, rules: rules.length }, null, 2));
  } else {
    console.log(`✓ Created preset "${id}" in ${scope}`);
    console.log(`  ${fp}`);
    console.log(`  ${rules.length} rule(s) attached`);
  }
}

// ─────────────────────────────────────────────────────────
// preset show <id> [--scope project|global] [--json]
// ─────────────────────────────────────────────────────────
export function cmdPresetShow(args: string[], cwd: string): void {
  const positional = args.filter((a) => !a.startsWith('--'));
  const id = positional[0];
  if (!id) die('preset show: <id> required');

  const asJson = hasFlag(args, '--json');
  const scopePref = flag(args, '--scope');

  const tryRead = (s: PresetScope): Preset | null => {
    try { return readPreset(id, s, cwd); } catch { return null; }
  };

  let preset: Preset | null = null;
  let foundIn: PresetScope = 'project';
  if (scopePref === 'global') {
    preset = tryRead('global');
    foundIn = 'global';
  } else if (scopePref === 'project') {
    preset = tryRead('project');
    foundIn = 'project';
  } else {
    preset = tryRead('project') ?? tryRead('global');
    foundIn = preset ? (tryRead('project') ? 'project' : 'global') : 'project';
  }

  if (!preset) die(`preset "${id}" not found in project or global.`);

  if (asJson) {
    console.log(JSON.stringify({ scope: foundIn, preset }, null, 2));
    return;
  }

  console.log(`\n${preset.name}  (${preset.id})`);
  console.log(`  scope:    ${foundIn}`);
  console.log(`  source:   ${preset.source ?? 'manual'}`);
  console.log(`  version:  ${preset.version ?? '1.0'}`);
  console.log(`  rules:    ${preset.rules.length}`);
  if (preset.description) console.log(`  desc:     ${preset.description}`);
  if (preset.metadata?.created_at) console.log(`  created:  ${preset.metadata.created_at}`);
  if (preset.metadata?.updated_at) console.log(`  updated:  ${preset.metadata.updated_at}`);

  if (preset.rules.length > 0) {
    console.log('\n  Rules:');
    for (const r of preset.rules) {
      const on = r.enabled === false ? 'off' : (r.threshold ?? 'error');
      const globSuffix = r.globs && r.globs.length > 0 ? `  globs: ${r.globs.join(', ')}` : '';
      console.log(`    - ${r.id.padEnd(36)} ${on}${globSuffix}`);
    }
  }
}

// ─────────────────────────────────────────────────────────
// preset apply <id> [--scope project|global] [--cwd <dir>]
// ─────────────────────────────────────────────────────────
export function cmdPresetApply(args: string[], cwd: string): void {
  const positional = args.filter((a) => !a.startsWith('--'));
  const id = positional[0];
  if (!id) die('preset apply: <id> required');

  const targetCwd = flag(args, '--cwd') ?? cwd;
  const { preset, applied_at } = applyPreset(id, targetCwd);
  console.log(`✓ Applied preset "${preset.id}" → ${path.join(targetCwd, '.checkit', 'state.json')}`);
  console.log(`  ${preset.rules.length} rule(s) will be active on next scan`);
  console.log(`  applied_at: ${applied_at}`);
}

// ─────────────────────────────────────────────────────────
// preset delete <id> [--scope project|global]
// ─────────────────────────────────────────────────────────
export function cmdPresetDelete(args: string[], cwd: string): void {
  const positional = args.filter((a) => !a.startsWith('--'));
  const id = positional[0];
  if (!id) die('preset delete: <id> required');

  const scope = resolveScope(args);
  if (!hasPreset(id, scope, cwd)) die(`preset "${id}" not found in ${scope}.`);
  deletePreset(id, scope, cwd);
  console.log(`✓ Deleted preset "${id}" from ${scope}`);
}

// ─────────────────────────────────────────────────────────
// preset export <id> --output <file> [--scope project|global]
// ─────────────────────────────────────────────────────────
export function cmdPresetExport(args: string[], cwd: string): void {
  const positional = args.filter((a) => !a.startsWith('--'));
  const id = positional[0];
  if (!id) die('preset export: <id> required\n  usage: <brand> preset export <id> --output <file>');

  const output = flag(args, '--output') ?? flag(args, '-o');
  if (!output) die('preset export: --output <file> required');

  const { to } = exportPreset(id, output, cwd);
  console.log(`✓ Exported preset "${id}" → ${to}`);
}

// ─────────────────────────────────────────────────────────
// preset import <file> [--scope project|global]
// ─────────────────────────────────────────────────────────
export function cmdPresetImport(args: string[], cwd: string): void {
  const positional = args.filter((a) => !a.startsWith('--'));
  const file = positional[0];
  if (!file) die('preset import: <file> required\n  usage: <brand> preset import <file-or-url>');

  // TODO Phase 2: support URL (gist etc). For now local file only.
  if (/^https?:\/\//.test(file)) die('preset import: URL import not yet implemented (Phase 2). Use a local file.');

  const fp = path.resolve(file);
  if (!fs.existsSync(fp)) die(`preset import: file not found: ${fp}`);

  const scope = resolveScope(args);
  const { preset, path: dst, scope: landed } = importPreset(fp, { scope, cwd });
  console.log(`✓ Imported preset "${preset.id}" → ${landed} (${dst})`);
  console.log(`  ${preset.rules.length} rule(s) attached`);
}

// ─────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────
function slugifyId(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'preset';
}

// re-export for top-level dispatcher
export const PRESET_COMMANDS = {
  list: cmdPresetList,
  new: cmdPresetNew,
  show: cmdPresetShow,
  apply: cmdPresetApply,
  delete: cmdPresetDelete,
  export: cmdPresetExport,
  import: cmdPresetImport,
} as const;

export type PresetCommandName = keyof typeof PRESET_COMMANDS;
