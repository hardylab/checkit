// spec:[spec](specs/backend/ai/adapters/claude.md)
import { exec } from 'child_process';
import { promisify } from 'util';
import type { AIAgent, AgentContext, AgentResult } from '../types';

const execAsync = promisify(exec);

/**
 * Claude Code CLI adapter
 *
 * 调用:`claude -p "<prompt>"` 从 stdin / cwd 工作
 * 文档:https://docs.claude.com/en/docs/claude-code/cli-reference
 *
 * 检查可用:`which claude` / `command -v claude`
 */
export class ClaudeAgent implements AIAgent {
  name = 'claude';
  displayName = 'Claude Code (claude CLI)';

  async isAvailable(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('which claude', { timeout: 5000 });
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  async run(prompt: string, context: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    try {
      // -p: print mode (one-shot, no REPL)
      // --output-format text: 纯文本输出
      // --dangerously-skip-permissions: 允许 AI 自由写文件
      // < /dev/null: 避免 stdin 警告
      const { stdout, stderr } = await execAsync(
        `claude -p --output-format text --dangerously-skip-permissions < /dev/null`,
        {
          cwd: 'D:/tmp',
          timeout: 120_000,
          maxBuffer: 10 * 1024 * 1024,
          input: prompt,  // 把 prompt 作为 stdin 给 claude
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
      const hasOutput = (e.stdout || '').trim().length > 0;
      return {
        agent: this.name,
        success: hasOutput,
        output: e.stdout || '',
        error: hasOutput ? undefined : (e.stderr || String(err)),
        durationMs: Date.now() - start,
        exitCode: e.code ?? 1,
      };
    }
  }
}

export default ClaudeAgent;
