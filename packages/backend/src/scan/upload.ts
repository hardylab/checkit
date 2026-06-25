// packages/backend/src/scan/upload.ts — `lintany scan --upload <file>`
//
// 用途:接收外部生成的 JSON 报告(desktop /api/scan、第三方扫描器、CI artifact)
// 走跟 `--reporter json` 一样的输出路径,不再扫文件。
//
// 输入格式(per desktop apps/desktop/app/api/scan/route.ts):
//   { issues: ReviewIssue[], source?: string, exitCode?: number }
// 或纯数组:ReviewIssue[]
//
// 输出格式跟 scan --reporter json 一样:JSON 数组(或空数组)写到 stdout。

import fs from 'node:fs';
import path from 'node:path';

export interface UploadOptions {
  file: string;
  reporter: 'stylish' | 'json' | 'silent';
  /** 跟 scan 一致,exit 0 unless 显式要求 */
  exitOnError?: boolean;
}

/** Best-effort parser:accepts the wrapper shape OR a bare array. */
export function readUploadReport(file: string): { issues: unknown[]; source?: string } {
  const raw = fs.readFileSync(file, 'utf-8');
  const data = JSON.parse(raw);
  if (Array.isArray(data)) return { issues: data };
  if (typeof data === 'object' && data !== null && Array.isArray((data as { issues?: unknown[] }).issues)) {
    const d = data as { issues: unknown[]; source?: string };
    return { issues: d.issues, source: d.source };
  }
  throw new Error(
    `Upload file is not a JSON array or { issues: [...] } object: ${file}\n` +
    `  Got: ${JSON.stringify(data).slice(0, 80)}…`,
  );
}

function renderStylish(issues: unknown[]): string {
  if (issues.length === 0) return '✓ No issues from uploaded report.\n';
  const lines: string[] = [`${issues.length} issue(s) from uploaded report:`];
  for (const raw of issues) {
    const i = raw as Record<string, unknown>;
    const level = String(i.level ?? 'info').toUpperCase();
    const file = String(i.file ?? '?');
    const line = i.line ? `:${i.line}` : '';
    const module = i.module ? `[${i.module}]` : '';
    const message = String(i.issue ?? i.message ?? '(no message)');
    lines.push(`  ${level.padEnd(5)} ${file}${line}  ${module}  ${message}`);
  }
  return lines.join('\n') + '\n';
}

export function runUpload(opts: UploadOptions): number {
  if (!fs.existsSync(opts.file)) {
    console.error(`error: upload file not found: ${opts.file}`);
    return 2;
  }
  let report;
  try {
    report = readUploadReport(opts.file);
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    return 2;
  }

  // Render to stdout unless silent.
  if (opts.reporter === 'json') {
    process.stdout.write(JSON.stringify(report.issues, null, 2) + '\n');
  } else if (opts.reporter === 'stylish') {
    process.stdout.write(renderStylish(report.issues));
  }
  // 'silent' = no output

  // Exit code:
  // - --exit-on-error → 1 if any issue has level === 'error', else 0
  // - default → 0 (upload is informational; doesn't fail the script)
  if (opts.exitOnError) {
    const hasError = report.issues.some((i: unknown) => {
      const lvl = (i as { level?: string }).level;
      return lvl === 'error';
    });
    return hasError ? 1 : 0;
  }
  return 0;
}

/** Re-export so cli.ts can find the file path type easily. */
export type UploadFilePath = string & { readonly __brand: 'UploadFilePath' };
export function normalizeUploadPath(raw: string): string {
  return path.resolve(raw);
}
