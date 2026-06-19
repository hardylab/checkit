// spec:[spec](specs/backend/ai/index.md)

export type { AIAgent, AgentContext, AgentResult } from './types';
export { ALL_AGENTS, AGENT_NAMES } from './registry';
export { detectAvailableAgents, pickFirstAvailable } from './detect';
export { aiFix } from './fix';
export type { AIFixConfig, AIFixResult } from './fix';
