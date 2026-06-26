// packages/backend/src/workspace/commands.ts — workspace CLI subcommands.
//
//   lintany workspace list
//   lintany workspace add <id> --name <name> --root <path> [--root <path>...]
//                              [--preset <id> [--preset <id>]...]
//   lintany workspace remove <id>
//   lintany workspace show <id>
//   lintany workspace scan <id> [--reporter json|table] [--fix]
//
// `scan <id>` runs the lintany scan pipeline against each root listed in
// the workspace, with the workspace's presets as the active rules. The
// "检测" button in the desktop UI calls this.

import fs from 'node:fs';
import path from 'node:path';
import {
  listWorkspaces,
  readWorkspace,
  writeWorkspace,
  deleteWorkspace,
  touchWorkspaceScanned,
  slugify,
} from './store.js';
import type { Workspace } from './schema.js';

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}
function flagValues(args: string[], name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name && i + 1 < args.length) out.push(args[i + 1]);
  }
  return out;
}
function flagValue(args: string[], name: string): string | undefined {
  return flagValues(args, name)[0];
}
function die(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}
function dieUsage(msg: string): never {
  console.error(`error: ${msg}\n  usage: lintany workspace <list|add|remove|show|scan> [opts]`);
  process.exit(1);
}
function positional(args: string[]): string[] {
  return args.filter((a) => !a.startsWith('--'));
}

export function cmdWorkspaceList(args: string[], _cwd: string): void {
  const asJson = hasFlag(args, '--json');
  const ws = listWorkspaces();
  if (asJson) {
    console.log(JSON.stringify({ workspaces: ws }, null, 2));
  } else if (ws.length === 0) {
    console.log('(no workspaces — use `lintany workspace add <id> ...`)');
  } else {
    for (const w of ws) {
      console.log(`  ${w.id.padEnd(20)}  ${w.name}  (${w.roots.length} root(s), ${w.presetIds.length} preset(s))`);
    }
  }
}

export function cmdWorkspaceAdd(args: string[], _cwd: string): void {
  const asJson = hasFlag(args, '--json');
  const pos = positional(args);
  const rawId = pos[0];
  if (!rawId) dieUsage('add requires <id>');
  const id = slugify(rawId);
  if (!id) dieUsage(`<id> must contain at least one alphanumeric char (got "${rawId}")`);

  const name = flagValue(args, '--name') ?? rawId;
  const description = flagValue(args, '--description');
  const roots = flagValues(args, '--root');
  const presetIds = flagValues(args, '--preset');

  if (roots.length === 0) {
    dieUsage('add requires at least one --root <path>');
  }
  // Validate roots exist.
  for (const r of roots) {
    if (!fs.existsSync(r)) {
      die(`root path does not exist: ${r}`);
    }
  }
  const record = writeWorkspace({
    id, name, description,
    roots, presetIds,
  });
  if (asJson) {
    console.log(JSON.stringify({ ok: true, workspace: record }, null, 2));
  } else {
    console.log(`✓ added workspace: ${record.id} (${record.name})`);
    console.log(`  ${record.roots.length} root(s), ${record.presetIds.length} preset(s)`);
  }
}

export function cmdWorkspaceRemove(args: string[], _cwd: string): void {
  const asJson = hasFlag(args, '--json');
  const pos = positional(args);
  const id = pos[0];
  if (!id) dieUsage('remove requires <id>');
  const removed = deleteWorkspace(id);
  if (asJson) {
    console.log(JSON.stringify({ ok: removed, id }, null, 2));
  } else if (removed) {
    console.log(`✓ removed workspace: ${id}`);
  } else {
    console.error(`✗ workspace "${id}" not found`);
    process.exit(1);
  }
}

export function cmdWorkspaceShow(args: string[], _cwd: string): void {
  const asJson = hasFlag(args, '--json');
  const pos = positional(args);
  const id = pos[0];
  if (!id) dieUsage('show requires <id>');
  const w = readWorkspace(id);
  if (asJson) {
    console.log(JSON.stringify({ found: !!w, workspace: w }, null, 2));
  } else if (w) {
    console.log(JSON.stringify(w, null, 2));
  } else {
    console.error(`✗ workspace "${id}" not found`);
    process.exit(1);
  }
}

/**
 * Scan a workspace: run the lintany pipeline against each root, applying
 * the workspace's presets. This is the backend of the desktop "检测" button.
 *
 * Output: JSON object with one result per root. Exit 0 = all clean, 1 = issues found.
 *
 * Implementation: spawn a `lintany scan --cwd <root> --reporter json` child
 * process per root. We pass the workspace's preset list via the standard
 * config file mechanism (write a temp checkit.config.json inside the
 * root, or rely on the user's existing config). For the V1 implementation
 * we keep it simple: just run `lintany scan --cwd <root>` per root and
 * collect the JSON output. The user can install the workspace's presets
 * via the existing `lintany preset apply` flow before scanning.
 */
export async function cmdWorkspaceScan(args: string[], _cwd: string): Promise<void> {
  const asJson = hasFlag(args, '--json');
  const pos = positional(args);
  const id = pos[0];
  if (!id) dieUsage('scan requires <id>');
  const w = readWorkspace(id);
  if (!w) die(`workspace "${id}" not found`);

  const fix = hasFlag(args, '--fix');
  const reporter = flagValue(args, '--reporter') ?? (asJson ? 'json' : 'table');

  // Find the current executable (cli's own location) so we can spawn a
  // sibling `lintany scan` against the same dist/cli.cjs.
  // Important: use process.argv[1] (not __dirname) because __dirname is
  // affected by cwd changes. We resolve the absolute path at startup
  // before we change cwd inside this function.
  const cliPath = process.argv[1] && require('node:path').isAbsolute(process.argv[1])
    ? process.argv[1]
    : require('node:path').resolve(__dirname, 'cli.cjs');

  const { spawn } = await import('node:child_process');
  const results: Array<{ root: string; ok: boolean; issues: unknown[]; error?: string; stdout: string }> = [];
  let anyIssues = false;
  for (const root of w.roots) {
    const args2 = [cliPath, 'scan', '--cwd', root, '--reporter', 'json'];
    if (fix) args2.push('--fix');
    const child = spawn(process.execPath, args2, { env: process.env, windowsHide: true });
    const chunks: Buffer[] = [];
    const errs: Buffer[] = [];
    child.stdout.on('data', (b: Buffer) => chunks.push(b));
    child.stderr.on('data', (b: Buffer) => errs.push(b));
    const exitCode: number = await new Promise((resolve) => {
      child.on('close', (code) => resolve(code ?? 0));
    });
    const stdout = Buffer.concat(chunks).toString('utf-8');
    const stderr = Buffer.concat(errs).toString('utf-8');
    let issues: unknown[] = [];
    let parseOk = false;
    try {
      const parsed = JSON.parse(stdout);
      if (Array.isArray(parsed)) issues = parsed;
      else if (Array.isArray(parsed?.issues)) issues = parsed.issues;
      else if (Array.isArray(parsed?.results?.[0]?.issues)) issues = parsed.results[0].issues;
      parseOk = true;
    } catch { /* not JSON */ }
    const ok = exitCode === 0 && issues.length === 0;
    if (issues.length > 0) anyIssues = true;
    results.push({
      root, ok, issues,
      ...(parseOk ? {} : { stdout: stdout.slice(0, 500), error: stderr.slice(0, 200) }),
    });
  }
  touchWorkspaceScanned(id);

  if (asJson) {
    console.log(JSON.stringify({ workspace: id, results, anyIssues }, null, 2));
  } else {
    console.log(`Scanned workspace "${w.name}" (${w.id}):`);
    for (const r of results) {
      const count = r.issues.length;
      const status = r.error ? '✗' : r.ok ? '✓' : '⚠';
      console.log(`  ${status} ${r.root}  (${count} issue(s))${r.error ? '  ' + r.error : ''}`);
    }
  }
  if (anyIssues) process.exit(1);
}

export const WORKSPACE_COMMANDS = {
  list: cmdWorkspaceList,
  add: cmdWorkspaceAdd,
  remove: cmdWorkspaceRemove,
  show: cmdWorkspaceShow,
  scan: cmdWorkspaceScan,
  rm: cmdWorkspaceRemove,
} as const;

export type WorkspaceCommandName = keyof typeof WORKSPACE_COMMANDS;
