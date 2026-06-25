// packages/backend/src/chat/commands.ts — `lintany chat` CLI subcommand
//
// 用法:
//   lintany chat "帮我做一个 TS strict preset"
//   lintany chat --no-tui --json "credential"     # CI / 脚本管道模式
//   echo "any type" | lintany chat --stdin --json # pipe input
//
// `--no-tui` + `--json` 是为 CI 设计的:输出结构化 JSON 到 stdout,无 stdin TTY。

import { getAdapter, resolveAdapterId } from '../ai-adapter';
import { chatReply, type ChatReply } from './keyword-adapter.js';

/**
 * Read `process.argv` with encoding fallback for cross-platform safety.
 *
 * On Windows, when a parent process spawns us via `child_process.spawn`
 * with `process.execPath` (node) and a string[] args array, Node encodes
 * those args using the parent's active console code page (typically
 * cp936/GBK). When the parent then reads our stdout as UTF-8, strings
 * that contained Chinese characters appear as mojibake ("锟斤拷"
 * instead of "你好").
 *
 * Heuristic: if the raw bytes don't form valid UTF-8 (replacement chars
 * appear after decode), try decoding them as GBK. If that produces a
 * string with CJK chars, use it.
 */
function readArgvSafely(): string[] {
  const raw = process.argv;
  // No non-ASCII bytes anywhere → return as-is.
  const hasNonAscii = raw.some((a) => /[^\x00-\x7f]/.test(a));
  if (!hasNonAscii) return raw;
  // If argv was decoded properly (UTF-8), no fix needed.
  // We detect "mojibake" by looking for the specific pattern that GBK
  // produces when decoded as UTF-8: \uFFFD + \uFFFD (= "锟").
  // Simpler: re-encode and re-decode as GBK; if it produces valid CJK,
  // prefer that.
  try {
    const redecoded = raw.map((a) => {
      // Buffer.from(string, 'utf-8') round-trips exactly only if the
      // string was originally valid UTF-8. If it was GBK bytes decoded
      // as UTF-8, re-encoding as UTF-8 produces the GBK byte sequence.
      const buf = Buffer.from(a, 'utf-8');
      // Heuristic: if the resulting byte sequence contains sequences that
      // look like GBK (lead bytes 0x81-0xFE followed by 0x40-0xFE) and
      // NOT UTF-8 (lead bytes 0xC0-0xF7 followed by valid 0x80-0xBF),
      // it was GBK-decoded.
      const looksGbk = (() => {
        for (let i = 0; i < buf.length - 1; i++) {
          const b = buf[i];
          if (b >= 0x81 && b <= 0xfe) {
            const next = buf[i + 1];
            if (next >= 0x40 && next <= 0xfe) {
              // Could be either GBK or UTF-8 lead. Distinguish by GBK's
              // looser second-byte range vs UTF-8's strict 0x80-0xBF.
              // If next byte is in GBK-only range (0x40-0x7F), it's GBK.
              if (next <= 0x7f) return true;
            }
          }
        }
        return false;
      })();
      if (looksGbk) {
        try {
          return new TextDecoder('gbk', { fatal: true }).decode(buf);
        } catch {
          return a;
        }
      }
      return a;
    });
    return redecoded;
  } catch {
    return raw;
  }
}

/**
 * Write `s` to stdout as raw UTF-8 bytes, completely bypassing Node's
 * stream encoding layer.
 *
 * Why this is needed: on Windows, `process.stdout` is a TextDecoderWriter
 * that re-encodes Buffer arguments using the active console code page
 * (cp936/GBK by default). Even `Buffer.from(s, 'utf-8')` followed by
 * `process.stdout.write(buf)` ends up encoded as GBK when read by a
 * parent process that expects UTF-8.
 *
 * Solution: write directly to fd 1 with `fs.writeSync`, skipping Node's
 * stream layer entirely. POSIX shells and Windows readers both see
 * the raw UTF-8 bytes we intend.
 *
 * Activated by env var LINTANY_FORCE_UTF8_STDOUT=1 (set by desktop
 * /api/chat spawn wrapper). Default behavior (process.stdout.write)
 * remains for interactive terminals.
 */
import * as fs from 'node:fs';

const FORCE_UTF8 = process.env.LINTANY_FORCE_UTF8_STDOUT === '1';
function out(s: string): void {
  if (FORCE_UTF8) {
    // fd 1 = stdout, writeSync writes raw bytes (no encoding conversion).
    fs.writeSync(1, Buffer.from(s, 'utf-8'));
  } else {
    process.stdout.write(s);
  }
}
function outLine(s: string): void {
  out(s + '\n');
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

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (c) => { buf += c; });
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', reject);
    // TTY (no piped input) → empty string
    if (process.stdin.isTTY) resolve('');
  });
}

function die(msg: string, code = 1): never {
  console.error(`error: ${msg}`);
  process.exit(code);
}

export async function cmdChat(args: string[], cwd: string): Promise<void> {
  const noTui = hasFlag(args, '--no-tui');
  const asJson = hasFlag(args, '--json');
  const useStdin = hasFlag(args, '--stdin');
  const adapterFlag = flag(args, '--adapter');

  let message: string;
  if (useStdin) {
    message = (await readStdin()).trim();
  } else if (process.env.LINTANY_CHAT_MESSAGE_FILE) {
    // Spawned by desktop /api/chat which writes the message to a temp
    // file (UTF-8 bytes) and passes the path via env. This avoids Windows
    // spawn-arg GBK encoding corruption.
    const fs = require('node:fs') as typeof import('node:fs');
    try {
      message = fs.readFileSync(process.env.LINTANY_CHAT_MESSAGE_FILE, 'utf-8').trim();
    } catch (e) {
      throw new Error(`lintany chat: failed to read message file: ${(e as Error).message}`);
    }
  } else if (process.env.LINTANY_CHAT_MESSAGE !== undefined) {
    message = process.env.LINTANY_CHAT_MESSAGE;
  } else {
    const pos = positional(args);
    message = pos.join(' ').trim();
    if (message.length >= 2 && message.startsWith('"') && message.endsWith('"')) {
      try {
        message = JSON.parse(message) as string;
      } catch {
        // Not valid JSON — leave as-is and hope for the best.
      }
    }
  }

  if (!message) {
    if (noTui || asJson) {
      // CI mode: emit empty-result JSON, exit 0 (not an error — empty input is valid)
      outLine(JSON.stringify({ reply: '', suggestions: [], recommendedSets: [], adapter: 'local-keyword', message: '' }));
      return;
    }
    die('chat: message required\n  usage: lintany chat "<message>" [--no-tui] [--json] [--stdin] [--adapter openai|claude|local-keyword]');
  }

  const adapterId = resolveAdapterId(adapterFlag);
  let reply: ChatReply;
  try {
    const adapter = getAdapter(adapterId);
    reply = await adapter.chat(message, { cwd });
  } catch (e) {
    // Adapter construction or call failed — surface a clean error.
    if (noTui || asJson) {
      outLine(JSON.stringify({
        adapter: adapterId,
        message,
        error: (e as Error).message,
        reply: '',
        suggestions: [],
        recommendedSets: [],
      }, null, 2));
      process.exit(1);
    }
    die((e as Error).message);
  }

  if (asJson) {
    const out = { adapter: adapterId, message, ...reply };
    outLine(JSON.stringify(out, null, 2));
    return;
  }

  if (noTui) {
    // Plain text mode (no ANSI / no TUI) — for non-interactive shells
    const lines: string[] = [];
    lines.push(reply.reply);
    if (reply.recommendedSets.length > 0) {
      lines.push('');
      lines.push('Recommended presets:');
      for (const s of reply.recommendedSets) {
        lines.push(`  - ${s.id}  ${s.name}`);
      }
    }
    if (reply.suggestions.length > 0) {
      lines.push('');
      lines.push('Suggested rules:');
      for (const r of reply.suggestions) {
        lines.push(`  - ${r.id}  ${r.title}`);
      }
    }
    outLine(lines.join('\n'));
    return;
  }

  // Interactive TUI mode — minimal REPL for now (Phase 3 will upgrade to rich TUI)
  // For Phase 1 we always emit non-tui unless stdin is TTY + no --no-tui.
  // Detect TTY: if not TTY (e.g. CI), fall back to --no-tui behavior.
  if (!process.stdin.isTTY) {
    return cmdChat([...args, '--no-tui'], cwd);
  }

  // TTY path: print reply, prompt once, then exit. (Multi-turn REPL is Phase 3.)
  outLine(reply.reply);
  if (reply.recommendedSets.length > 0) {
    outLine('');
    outLine('Recommended presets:');
    for (const s of reply.recommendedSets) {
      outLine(`  - ${s.id}  ${s.name}`);
    }
  }
  if (reply.suggestions.length > 0) {
    outLine('');
    outLine('Suggested rules:');
    for (const r of reply.suggestions) {
      outLine(`  - ${r.id}  ${r.title}`);
    }
  }
  // Phase 3 will replace this with prompt-sync readline loop.
  // For now single-shot only — `--no-tui --json` is the path to CI.
}

export type ChatCommandFn = (args: string[], cwd: string) => Promise<void>;
