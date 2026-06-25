// packages/backend/src/doctor/checks.test.ts — environment diagnostic
import { describe, it, expect } from 'vitest';
import { runDoctor } from './checks.js';

// These tests spawn child processes (git, agent CLIs). Generous timeout
// because CI / Windows first-exec can be slow.
const TEST_TIMEOUT = 30_000;

describe('runDoctor — required checks', () => {
  it('Node.js is always present in test env', { timeout: TEST_TIMEOUT }, () => {
    const r = runDoctor(process.cwd());
    const nodeCheck = r.results.find((c) => c.name === 'Node.js');
    expect(nodeCheck).toBeDefined();
    expect(nodeCheck!.status).toBe('ok');
    expect(nodeCheck!.message).toMatch(/v\d/);
  });

  it('CLI version reported', { timeout: TEST_TIMEOUT }, () => {
    const r = runDoctor(process.cwd());
    const cliCheck = r.results.find((c) => c.name === 'CLI');
    expect(cliCheck).toBeDefined();
    // Either ok (we have package.json) or warn (build artifact not found)
    expect(['ok', 'warn']).toContain(cliCheck!.status);
  });

  it('project preset dir is created/readable', { timeout: TEST_TIMEOUT }, () => {
    const r = runDoctor(process.cwd());
    const dirCheck = r.results.find((c) => c.name === 'project preset dir');
    expect(dirCheck).toBeDefined();
    expect(dirCheck!.status).toBe('ok');
  });

  it('global config dir is created/readable', { timeout: TEST_TIMEOUT }, () => {
    const r = runDoctor(process.cwd());
    const dirCheck = r.results.find((c) => c.name === 'global config dir');
    expect(dirCheck).toBeDefined();
    expect(dirCheck!.status).toBe('ok');
  });

  it('summary counts match result statuses', { timeout: TEST_TIMEOUT }, () => {
    const r = runDoctor(process.cwd());
    const countedOk = r.results.filter((x) => x.status === 'ok').length;
    const countedWarn = r.results.filter((x) => x.status === 'warn').length;
    const countedFail = r.results.filter((x) => x.status === 'fail').length;
    expect(r.summary.ok).toBe(countedOk);
    expect(r.summary.warn).toBe(countedWarn);
    expect(r.summary.fail).toBe(countedFail);
  });
});

describe('runDoctor — agent detection', () => {
  it('reports all four candidate agents', { timeout: TEST_TIMEOUT }, () => {
    const r = runDoctor(process.cwd());
    const agentNames = r.results.filter((c) => c.name.startsWith('agent:')).map((c) => c.name);
    expect(agentNames.sort()).toEqual(['agent:claude', 'agent:hermes', 'agent:openclaw', 'agent:opencode']);
  });

  it('agent status is always ok or warn (never fail — they are optional)', { timeout: TEST_TIMEOUT }, () => {
    const r = runDoctor(process.cwd());
    for (const c of r.results) {
      if (c.name.startsWith('agent:')) {
        expect(['ok', 'warn']).toContain(c.status);
      }
    }
  });
});
