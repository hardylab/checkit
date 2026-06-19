import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlowNamingRule } from '../flow-naming-rule';
import type { RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

vi.mock('fs');
vi.mock('path');

describe('FlowNamingRule', () => {
  const mockContext: RuleContext = {
    cwd: '/mock',
    projectRoot: '/mock',
    targetPath: '/mock/path',
    targetName: 'test-module',
    targetType: 'project',
    files: [], // Set per test
    autoFix: false,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(path.join).mockImplementation((...args) => args.join('/'));
    vi.mocked(path.basename).mockImplementation((p, ext) => {
      const name = p.split('/').pop() || '';
      return ext ? name.replace(ext, '') : name;
    });
  });

  it('should pass for valid naming', () => {
    const content = `
      export class PdcaPlanRule implements ReviewRule {
        flow = { key: 'pdca', order: 1 };
      }
    `;
    vi.mocked(fs.readFileSync).mockReturnValue(content);

    const rule = new FlowNamingRule({});
    const context = { ...mockContext, files: ['pdca-plan-rule.ts'] };
    const issues = rule.check(context);

    expect(issues).toHaveLength(0);
  });

  it('should report error for invalid class name', () => {
    const content = `
      export class PlanRule implements ReviewRule {
        flow = { key: 'pdca', order: 1 };
      }
    `;
    vi.mocked(fs.readFileSync).mockReturnValue(content);

    const rule = new FlowNamingRule({});
    const context = { ...mockContext, files: ['pdca-plan-rule.ts'] };
    const issues = rule.check(context);

    expect(issues).toHaveLength(1);
    expect(issues[0].issue).toContain(
      "Class 'PlanRule' belongs to flow 'pdca' but does not start with 'Pdca'"
    );
  });

  it('should report error for invalid filename', () => {
    const content = `
      export class PdcaPlanRule implements ReviewRule {
        flow = { key: 'pdca', order: 1 };
      }
    `;
    vi.mocked(fs.readFileSync).mockReturnValue(content);

    const rule = new FlowNamingRule({});
    const context = { ...mockContext, files: ['plan-rule.ts'] };
    const issues = rule.check(context);

    expect(issues).toHaveLength(1);
    expect(issues[0].issue).toContain(
      "File 'plan-rule.ts' contains flow 'pdca' rule but filename does not start with 'pdca-'"
    );
  });

  it('should report errors for both invalid class and filename', () => {
    const content = `
      export class PlanRule implements ReviewRule {
        flow = { key: 'pdca', order: 1 };
      }
    `;
    vi.mocked(fs.readFileSync).mockReturnValue(content);

    const rule = new FlowNamingRule({});
    const context = { ...mockContext, files: ['plan-rule.ts'] };
    const issues = rule.check(context);

    expect(issues).toHaveLength(2);
  });

  it('should ignore rules without flow', () => {
    const content = `
      export class NormalRule implements ReviewRule {
        id = 'normal-rule';
      }
    `;
    vi.mocked(fs.readFileSync).mockReturnValue(content);

    const rule = new FlowNamingRule({});
    const context = { ...mockContext, files: ['normal-rule.ts'] };
    const issues = rule.check(context);

    expect(issues).toHaveLength(0);
  });

  it('should handle complex flow definition', () => {
    const content = `
      export class MyFlowStepRule implements ReviewRule {
        other = 1;
        flow: { key: string; order: number } = {
          key: 'my-flow',
          order: 2
        };
      }
    `;
    vi.mocked(fs.readFileSync).mockReturnValue(content);

    const rule = new FlowNamingRule({});
    // Expected class: MyFlow... Expected file: my-flow-...
    const context = { ...mockContext, files: ['my-flow-step.ts'] };
    const issues = rule.check(context);

    expect(issues).toHaveLength(0);
  });

  it('should fail complex flow definition with wrong name', () => {
    const content = `
      export class StepRule implements ReviewRule {
        flow = { key: 'my-flow', order: 2 };
      }
    `;
    vi.mocked(fs.readFileSync).mockReturnValue(content);

    const rule = new FlowNamingRule({});
    const context = { ...mockContext, files: ['step.ts'] };
    const issues = rule.check(context);

    expect(issues).toHaveLength(2);
    expect(issues[0].issue).toContain(
      "Class 'StepRule' belongs to flow 'my-flow' but does not start with 'MyFlow'"
    );
  });
});
