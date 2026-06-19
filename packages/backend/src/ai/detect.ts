// spec:[spec](specs/backend/ai/detect.md)
import type { AIAgent } from './types';
import { ALL_AGENTS } from './registry';

/**
 * 自动检测本机已装 AI agent
 *
 * 排除 hermes(默认,元编程风险,见 registry.ts 注释)
 */
export async function detectAvailableAgents(
  excludeNames: string[] = ['hermes']
): Promise<AIAgent[]> {
  const checks = await Promise.all(
    ALL_AGENTS.map(async (agent) => ({
      agent,
      available: excludeNames.includes(agent.name) ? false : await agent.isAvailable(),
    }))
  );
  return checks.filter((c) => c.available).map((c) => c.agent);
}

/**
 * 选第一个可用的 agent
 */
export async function pickFirstAvailable(
  excludeNames: string[] = ['hermes']
): Promise<AIAgent | null> {
  const available = await detectAvailableAgents(excludeNames);
  return available[0] ?? null;
}
