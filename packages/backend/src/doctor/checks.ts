// packages/backend/src/doctor/checks.ts — environment diagnostic checks
//
// 用途:`lintany doctor` 报告用户当前机器上 checkit 工作链是否就绪。
// 检查项(MSP 第 4 节 `checkit doctor` 要求):
//   - Node.js version (>= 18)
//   - CLI itself (version, install path)
//   - Per-project preset dir (cwd/.checkit/presets) — readable / writable
//   - Global config dir (~/.checkit/) — readable / writable
//   - Git (for scan --recent / preset export)
//   - AI agents on PATH: claude / opencode / hermes / openclaw (best-effort)

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

export interface CheckResult {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  message: string;
  details?: string;
}

export interface DoctorReport {
  ok: boolean;
  results: CheckResult[];
  summary: { ok: number; warn: number; fail: number };
}

/** Try to read CLI package.json from compiled dist or src tree. */
function cliVersion(): string | undefined {
  // We are running from packages/backend/dist/cli.cjs; resolve back to package.json.
  const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  // here is .../packages/backend/dist or .../packages/backend/dist/esm — try both
  const candidates = [
    path.resolve(here, '..', 'package.json'),    // dist → package.json
    path.resolve(here, '..', '..', 'package.json'), // dist/esm → package.json
  ];
  for (const c of candidates) {
    try {
      const pkg = JSON.parse(fs.readFileSync(c, 'utf-8'));
      if (typeof pkg.version === 'string') return pkg.version;
    } catch { /* ignore */ }
  }
  return undefined;
}

function tryReadVersion(bin: string, prefixToStrip?: string): string | undefined {
  try {
    // Aggressive timeout (2s) — agent discovery is best-effort, not critical.
    const out = execFileSync(bin, ['--version'], {
      encoding: 'utf-8',
      timeout: 2_000,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    // Use the FIRST non-empty line; version is always first.
    const firstLine = out.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0);
    if (!firstLine) return undefined;
    let token = firstLine.split(/\s+/)[0] || undefined;
    // Strip optional leading "v" for niceness: "v2.1.109" → "2.1.109"
    if (token && /^v\d/.test(token)) token = token.slice(1);
    // Optionally strip a known prefix word (e.g. "git" → "")
    if (token && prefixToStrip && token.toLowerCase() === prefixToStrip.toLowerCase()) {
      // The version may follow in any subsequent token: "git version 2.50.1"
      const parts = firstLine.split(/\s+/);
      const idx = parts.findIndex((p) => p.toLowerCase() === prefixToStrip.toLowerCase());
      for (let j = idx + 1; j < parts.length; j++) {
        if (/^\d/.test(parts[j])) {
          token = /^v/.test(parts[j]) ? parts[j].slice(1) : parts[j];
          break;
        }
      }
    }
    return token;
  } catch {
    return undefined;
  }
}

function checkNode(): CheckResult {
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 18) {
    return { name: 'Node.js', status: 'ok', message: `v${process.versions.node}`, details: '>= 18 required' };
  }
  return { name: 'Node.js', status: 'fail', message: `v${process.versions.node}`, details: '< 18 — please upgrade' };
}

function checkCliItself(): CheckResult {
  const v = cliVersion();
  if (v) return { name: 'CLI', status: 'ok', message: `@checkit/cli v${v}` };
  return { name: 'CLI', status: 'warn', message: 'version unknown', details: 'package.json not found near dist/' };
}

function checkProjectPresetDir(cwd: string): CheckResult {
  const dir = path.join(cwd, '.checkit', 'presets');
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, '.doctor-probe');
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return { name: 'project preset dir', status: 'ok', message: dir };
  } catch (e) {
    return { name: 'project preset dir', status: 'fail', message: dir, details: (e as Error).message };
  }
}

function checkGlobalConfig(): CheckResult {
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  const dir = path.join(home, '.checkit');
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, '.doctor-probe');
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return { name: 'global config dir', status: 'ok', message: dir };
  } catch (e) {
    return { name: 'global config dir', status: 'fail', message: dir, details: (e as Error).message };
  }
}

function checkGit(): CheckResult {
  const v = tryReadVersion('git', 'git');
  if (!v) return { name: 'git', status: 'warn', message: 'not found', details: 'optional — needed for scan --recent' };
  return { name: 'git', status: 'ok', message: `v${v}` };
}

function checkAgent(name: string): CheckResult {
  const v = tryReadVersion(name);
  if (v) return { name: `agent:${name}`, status: 'ok', message: `v${v}` };
  return { name: `agent:${name}`, status: 'warn', message: 'not found', details: 'optional — needed for --ai-fix' };
}

export function runDoctor(cwd: string): DoctorReport {
  const results: CheckResult[] = [
    checkNode(),
    checkCliItself(),
    checkProjectPresetDir(cwd),
    checkGlobalConfig(),
    checkGit(),
    checkAgent('claude'),
    checkAgent('opencode'),
    checkAgent('hermes'),
    checkAgent('openclaw'),
  ];
  const summary = {
    ok: results.filter((r) => r.status === 'ok').length,
    warn: results.filter((r) => r.status === 'warn').length,
    fail: results.filter((r) => r.status === 'fail').length,
  };
  return {
    ok: summary.fail === 0,
    results,
    summary,
  };
}
