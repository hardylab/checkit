// packages/backend/src/doctor/commands.ts — `lintany doctor` CLI
//
// 输出人类可读 + `--json` 结构化两种。
// exit code: 0 if no `fail`, 1 if any `fail`, 2 if only `warn`。
import { runDoctor, type DoctorReport } from './checks.js';

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

export function cmdDoctor(args: string[], cwd: string): void {
  const report = runDoctor(cwd);

  if (hasFlag(args, '--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`lintany doctor — ${report.summary.ok} ok, ${report.summary.warn} warn, ${report.summary.fail} fail\n`);
    for (const r of report.results) {
      const icon = r.status === 'ok' ? '✓' : r.status === 'warn' ? '⚠' : '✗';
      console.log(`  ${icon} ${r.name.padEnd(22)} ${r.message}`);
      if (r.details) console.log(`     ${r.details}`);
    }
    if (!report.ok) {
      console.log('\nSome checks failed. Fix the items marked with ✗ before running scans.');
    }
  }

  if (report.summary.fail > 0) process.exit(1);
  if (report.summary.warn > 0) process.exit(2);
}
