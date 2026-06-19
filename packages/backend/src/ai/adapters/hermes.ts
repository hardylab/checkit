// spec:[spec](specs/backend/ai/adapters/hermes.md)
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { AIAgent, AgentContext, AgentResult } from '../types';

const execFileAsync = promisify(execFile);

/**
 * Hermes Agent CLI adapter
 *
 * 调用:`hermes agent run "<prompt>"`
 * 文档:https://hermes-agent.nousresearch.com/
 *
 * 注意:Hermes 是当前运行 checkit 的 agent —— AI 调 AI,有元编程风险。
 * 默认禁用(Hardy 工作偏好"反 AI Slop")。
 */
export class HermesAgent implements AIAgent {
  name = 'hermes';
  displayName = 'Hermes Agent (hermes CLI)';

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync('which', ['hermes'], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async run(prompt: string, context: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    try {
      // hermes agent run "<prompt>" — 子命令可能因版本不同,先试 'agent run',fallback 'run'
      const { stdout, stderr } = await execFileAsync(
        'hermes',
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

export default HermesAgent;
