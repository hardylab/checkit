import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiFix } from './fix';
import * as registry from './registry';
import * as detect from './detect';
import type { AIAgent, AgentResult } from './types';
import type { ReviewIssue } from '@checkit/shared';

const sampleIssue: ReviewIssue = {
  type: 'state',
  module: 'test',
  file: 'a.tsx',
  line: 5,
  issue: "calls hook 'useState'",
  expect: 'Move to *.frame.tsx',
  level: 'error',
  fixable: true,
};

describe('aiFix', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns empty result when no issues', async () => {
    const result = await aiFix([], { workspace: '/tmp' });
    expect(result.totalIssues).toBe(0);
    expect(result.fixedCount).toBe(0);
  });

  it('uses specified agent', async () => {
    // Mock the registry module before re-importing fix
    const mock: AIAgent = {
      name: 'claude',
      displayName: 'Mock',
      isAvailable: async () => true,
      run: async (): Promise<AgentResult> => ({
        agent: 'claude', success: true, output: 'ok', durationMs: 1, exitCode: 0,
      }),
    };
    vi.doMock('./registry', () => ({ ALL_AGENTS: [mock] }));
    const { aiFix: freshFix } = await import('./fix');
    const result = await freshFix([sampleIssue], { workspace: '/tmp' }, { agentName: 'claude' });
    expect(result.agentUsed).toBe('claude');
    expect(result.fixedCount).toBe(1);
  });

  it('reports failed fixes', async () => {
    const mock: AIAgent = {
      name: 'opencode',
      displayName: 'Mock',
      isAvailable: async () => true,
      run: async (): Promise<AgentResult> => ({
        agent: 'opencode', success: false, output: '', error: 'mock fail', durationMs: 0, exitCode: 1,
      }),
    };
    vi.doMock('./registry', () => ({ ALL_AGENTS: [mock] }));
    const { aiFix: freshFix } = await import('./fix');
    const result = await freshFix([sampleIssue], { workspace: '/tmp' }, { agentName: 'opencode' });
    expect(result.failedCount).toBe(1);
    expect(result.details[0].status).toBe('failed');
  });

  it('skips when no agent available', async () => {
    vi.doMock('./registry', () => ({
      ALL_AGENTS: [],  // 都不 available
      pickFirstAvailable: async () => null,
    }));
    const { aiFix: freshFix } = await import('./fix');
    const result = await freshFix([sampleIssue], { workspace: '/tmp' });
    expect(result.skippedCount).toBe(1);
    expect(result.details[0].status).toBe('skipped');
  });

  it('throws on unknown agent name', async () => {
    vi.doMock('./registry', () => ({ ALL_AGENTS: [] }));
    const { aiFix: freshFix } = await import('./fix');
    await expect(
      freshFix([sampleIssue], { workspace: '/tmp' }, { agentName: 'nonexistent' })
    ).rejects.toThrow(/Unknown AI agent/);
  });

  it('processes multiple issues sequentially', async () => {
    const calls: string[] = [];
    const mock: AIAgent = {
      name: 'claude',
      displayName: 'Mock',
      isAvailable: async () => true,
      run: async (prompt: string): Promise<AgentResult> => {
        calls.push(prompt.slice(0, 10));
        return { agent: 'claude', success: true, output: 'ok', durationMs: 1, exitCode: 0 };
      },
    };
    vi.doMock('./registry', () => ({ ALL_AGENTS: [mock] }));
    const { aiFix: freshFix } = await import('./fix');
    const issues = [sampleIssue, { ...sampleIssue, file: 'b.tsx' }, { ...sampleIssue, file: 'c.tsx' }];
    const result = await freshFix(issues, { workspace: '/tmp' }, { agentName: 'claude' });
    expect(result.fixedCount).toBe(3);
    expect(calls).toHaveLength(3);
  });
});
