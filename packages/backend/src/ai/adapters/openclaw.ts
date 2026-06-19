// spec:[spec](specs/backend/ai/adapters/openclaw.md)
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { AIAgent, AgentContext, AgentResult } from '../types';

const execFileAsync = promisify(execFile);

/**
 * OpenClaw CLI adapter
 *
 * 调用:`openclaw agent run "<prompt>"`
 * 文档:https://github.com/openclaw/openclaw
 */
export class OpenClawAgent implements AIAgent {
  name = 'openclaw';
  displayName = 'OpenClaw (openclaw CLI)';

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync('which', ['openclaw'], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async run(prompt: string, context: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    try {
      const { stdout, stderr } = await execFileAsync(
        'openclaw',
        ['agent', 'run', prompt],
        {
          cwd: context.workspace,
          timeout: 120_000,
          maxBuffer: 10 * 1024 * 1024,
        }
      );
      return {
        agent: this.name,
        success: true,
        output: stdout,
        durationMs: Date.now() - start,
        exitCode: 0,
      };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; code?: number };
      return {
        agent: this.name,
        success: false,
        output: e.stdout || '',
        error: e.stderr || String(err),
        durationMs: Date.now() - start,
        exitCode: e.code ?? 1,
      };
    }
  }
}

export default OpenClawAgent;
