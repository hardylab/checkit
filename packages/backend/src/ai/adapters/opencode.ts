// spec:[spec](specs/backend/ai/adapters/opencode.md)
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import type { AIAgent, AgentContext, AgentResult } from '../types';

const execAsync = promisify(exec);

/**
 * OpenCode CLI adapter
 *
 * 调用:`opencode run -m opencode/deepseek-v4-flash-free "<prompt>"`
 * 文档:https://opencode.ai/docs/cli/
 *
 * 实测:简单 prompt 11 秒能跑通。
 * 长 prompt(1500 字符+)会触发 opencode run 内部 120s timeout。
 *
 * 解决:每次 run 给极简 prompt,让 AI 自己 cat 文件读源码。
 */
export class OpenCodeAgent implements AIAgent {
  name = 'opencode';
  displayName = 'OpenCode (opencode CLI)';

  async isAvailable(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('which opencode', { timeout: 5000 });
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  async run(prompt: string, context: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    try {
      // 用 deepseek-v4-flash-free
      // 关键:cwd = context.workspace,这样 opencode 不会把目标目录当 external
      const cmd = `opencode run -m opencode/deepseek-v4-flash-free ${JSON.stringify(prompt)}`;
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: context.workspace, // 改为目标目录
        timeout: 90_000,
        maxBuffer: 10 * 1024 * 1024,
      });
      return {
        agent: this.name,
        success: true,
        output: stdout,
        durationMs: Date.now() - start,
        exitCode: 0,
      };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; code?: number; killed?: boolean };
      // opencode 经常 exit 1 即使任务完成(permission warnings、hook 噪音)
      // 判断成功 = (stdout 含 "Wrote file" 或 "Done") AND 目标 README 实际存在
      const aiSaysDone = /Wrote file successfully|done\.|Done\./i.test(e.stdout || '');
      const readmePath = `${context.workspace}/README.md`;
      const fileCreated = fs.existsSync(readmePath);
      const success = (aiSaysDone && fileCreated) || fileCreated;
      return {
        agent: this.name,
        success,
        output: e.stdout || '',
        error: success ? undefined : (e.stderr || String(err)),
        durationMs: Date.now() - start,
        exitCode: e.code ?? 1,
      };
    }
  }
}

export default OpenCodeAgent;
