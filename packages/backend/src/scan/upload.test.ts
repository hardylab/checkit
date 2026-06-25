// packages/backend/src/scan/upload.test.ts — `lintany scan --upload` handler
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { readUploadReport, runUpload } from './upload.js';

let tmpDir: string;
const origStdoutWrite = process.stdout.write.bind(process.stdout);

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lintany-upload-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  process.stdout.write = origStdoutWrite;
});

function captureStdout(fn: () => number | void): { code: number | void; out: string } {
  let buf = '';
  process.stdout.write = ((chunk: string | Uint8Array) => {
    buf += typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
    return true;
  }) as typeof process.stdout.write;
  const code = fn();
  return { code, out: buf };
}

function writeJson(name: string, data: unknown): string {
  const fp = path.join(tmpDir, name);
  fs.writeFileSync(fp, JSON.stringify(data));
  return fp;
}

describe('readUploadReport', () => {
  it('parses bare array', () => {
    const fp = writeJson('a.json', [{ level: 'error', file: 'x.ts', line: 1, issue: 'y' }]);
    const r = readUploadReport(fp);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]).toMatchObject({ level: 'error', file: 'x.ts' });
  });

  it('parses wrapper shape {issues:[…], source}', () => {
    const fp = writeJson('b.json', { source: 'ci', exitCode: 1, issues: [{ level: 'warn' }] });
    const r = readUploadReport(fp);
    expect(r.issues).toHaveLength(1);
    expect(r.source).toBe('ci');
  });

  it('rejects object without issues array', () => {
    const fp = writeJson('c.json', { source: 'x' });
    expect(() => readUploadReport(fp)).toThrow(/not a JSON array/);
  });

  it('rejects string', () => {
    const fp = writeJson('d.json', 'not an object');
    expect(() => readUploadReport(fp)).toThrow();
  });
});

describe('runUpload — reporters', () => {
  it('silent reporter writes nothing', () => {
    const fp = writeJson('e.json', [{ level: 'error', file: 'a.ts' }]);
    const { out } = captureStdout(() => runUpload({ file: fp, reporter: 'silent' }));
    expect(out).toBe('');
  });

  it('json reporter writes the issues array', () => {
    const fp = writeJson('f.json', [{ level: 'error', file: 'a.ts' }]);
    const { out } = captureStdout(() => runUpload({ file: fp, reporter: 'json' }));
    expect(JSON.parse(out.trim())).toEqual([{ level: 'error', file: 'a.ts' }]);
  });

  it('stylish reporter formats the issues', () => {
    const fp = writeJson('g.json', [
      { level: 'error', file: 'src/a.ts', line: 3, issue: 'console.log', module: 'no-console-log' },
      { level: 'warning', file: 'src/b.ts', line: 7, issue: 'any', module: 'no-any-rule' },
    ]);
    const { out } = captureStdout(() => runUpload({ file: fp, reporter: 'stylish' }));
    expect(out).toMatch(/2 issue/);
    expect(out).toMatch(/ERROR/);
    expect(out).toMatch(/WARNING/);
    expect(out).toMatch(/no-console-log/);
    expect(out).toMatch(/no-any-rule/);
  });

  it('stylish reporter on empty issues shows checkmark', () => {
    const fp = writeJson('h.json', []);
    const { out } = captureStdout(() => runUpload({ file: fp, reporter: 'stylish' }));
    expect(out).toMatch(/No issues/);
  });
});

describe('runUpload — exit codes', () => {
  it('default exit 0 even with error-level issues (informational)', () => {
    const fp = writeJson('i.json', [{ level: 'error', file: 'a.ts' }]);
    const { code } = captureStdout(() => runUpload({ file: fp, reporter: 'silent' }));
    expect(code).toBe(0);
  });

  it('--exit-on-error flips to exit 1 if any error', () => {
    const fp = writeJson('j.json', [
      { level: 'error', file: 'a.ts' },
      { level: 'warning', file: 'b.ts' },
    ]);
    const { code } = captureStdout(() => runUpload({ file: fp, reporter: 'silent', exitOnError: true }));
    expect(code).toBe(1);
  });

  it('--exit-on-error returns 0 when no errors', () => {
    const fp = writeJson('k.json', [{ level: 'warning', file: 'a.ts' }]);
    const { code } = captureStdout(() => runUpload({ file: fp, reporter: 'silent', exitOnError: true }));
    expect(code).toBe(0);
  });

  it('missing file returns 2', () => {
    const { code } = captureStdout(() => runUpload({ file: path.join(tmpDir, 'nope.json'), reporter: 'silent' }));
    expect(code).toBe(2);
  });

  it('invalid JSON returns 2', () => {
    const fp = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(fp, 'not json');
    const { code } = captureStdout(() => runUpload({ file: fp, reporter: 'silent' }));
    expect(code).toBe(2);
  });
});
