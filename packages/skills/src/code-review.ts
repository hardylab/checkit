import { execSync } from 'node:child_process';

function run(cmd: string): { ok: boolean; output: string } {
  try {
    const out = execSync(cmd, { stdio: 'pipe' }).toString();
    process.stdout.write(out);
    return { ok: true, output: out };
  } catch (e: unknown) {
    const msg = (e as Error).message ?? String(e);
    const out = (e as any)?.stdout ? (e as any).stdout.toString() : '';
    const err = (e as any)?.stderr ? (e as any).stderr.toString() : '';
    const combined = `${out}${err}\n${msg}`;
    process.stdout.write(combined);
    return { ok: false, output: combined };
  }
}

function hasWarnOrError(text: string): boolean {
  const t = text.toLowerCase();
  return t.includes('warning') || t.includes('error') || t.includes('err_');
}

function main() {
  const maxRounds = 5;
  const tscShared = run('pnpm exec tsc -p ../shared/tsconfig.json');
  const tscBackend = run('pnpm exec tsc --noEmit -p ../backend/tsconfig.json');
  const tscCombined = `${tscShared.output}\n${tscBackend.output}`;
  if (!tscShared.ok || !tscBackend.ok || hasWarnOrError(tscCombined)) {
    process.exitCode = 1;
    return;
  }

  for (let i = 0; i < maxRounds; i++) {
    const test = run('pnpm -w -r test');
    const accept = run('pnpm --filter @checkit/backend exec tsx src/main.ts . --fix');
    const combined = `${test.output}\n${accept.output}`;
    if (!hasWarnOrError(combined)) {
      const confirm = run('pnpm -w -r test');
      if (!hasWarnOrError(confirm.output)) {
        process.exitCode = 0;
        return;
      }
    }
  }
  process.exitCode = 1;
}

main();
