// packages/backend/src/chat/commands.ts — `lintany chat` CLI subcommand
//
// 用法:
//   lintany chat "帮我做一个 TS strict preset"
//   lintany chat --no-tui --json "credential"     # CI / 脚本管道模式
//   echo "any type" | lintany chat --stdin --json # pipe input
//
// `--no-tui` + `--json` 是为 CI 设计的:输出结构化 JSON 到 stdout,无 stdin TTY。

import { chatReply, type ChatReply } from './keyword-adapter.js';

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

export async function cmdChat(args: string[], _cwd: string): Promise<void> {
  const noTui = hasFlag(args, '--no-tui');
  const asJson = hasFlag(args, '--json');
  const useStdin = hasFlag(args, '--stdin');
  const adapter = flag(args, '--adapter') ?? 'local-keyword';

  let message: string;
  if (useStdin) {
    message = (await readStdin()).trim();
  } else {
    const pos = positional(args);
    message = pos.join(' ').trim();
  }

  if (!message) {
    if (noTui || asJson) {
      // CI mode: emit empty-result JSON, exit 0 (not an error — empty input is valid)
      console.log(JSON.stringify({ reply: '', suggestions: [], recommendedSets: [], adapter, message: '' }));
      return;
    }
    die('chat: message required\n  usage: lintany chat "<message>" [--no-tui] [--json] [--stdin]');
  }

  const reply = await chatReply(message, { adapter });

  if (asJson) {
    const out = { adapter, message, ...reply };
    console.log(JSON.stringify(out, null, 2));
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
    console.log(lines.join('\n'));
    return;
  }

  // Interactive TUI mode — minimal REPL for now (Phase 3 will upgrade to rich TUI)
  // For Phase 1 we always emit non-tui unless stdin is TTY + no --no-tui.
  // Detect TTY: if not TTY (e.g. CI), fall back to --no-tui behavior.
  if (!process.stdin.isTTY) {
    return cmdChat([...args, '--no-tui'], _cwd);
  }

  // TTY path: print reply, prompt once, then exit. (Multi-turn REPL is Phase 3.)
  console.log(reply.reply);
  if (reply.recommendedSets.length > 0) {
    console.log('');
    console.log('Recommended presets:');
    for (const s of reply.recommendedSets) {
      console.log(`  - ${s.id}  ${s.name}`);
    }
  }
  if (reply.suggestions.length > 0) {
    console.log('');
    console.log('Suggested rules:');
    for (const r of reply.suggestions) {
      console.log(`  - ${r.id}  ${r.title}`);
    }
  }
  // Phase 3 will replace this with prompt-sync readline loop.
  // For now single-shot only — `--no-tui --json` is the path to CI.
}

export type ChatCommandFn = (args: string[], cwd: string) => Promise<void>;
