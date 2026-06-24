// packages/backend/src/preset/schema.ts — preset data shape
//
// 设计原则:
// - preset = 用户可编辑、跨项目复用的规则集合
// - rule-set = 仓库内置只读规则集(不归 preset 管)
// - 数据落文件系统(per-project + global),不碰 IndexedDB / localStorage

/**
 * 单条 rule 在 preset 里的配置。
 * 比 bundled rule 多 3 个用户可控字段:enabled / threshold / globs。
 */
export interface PresetRuleConfig {
  id: string;                                  // rule id,如 "no-any-rule"
  enabled?: boolean;                           // default true
  threshold?: 'off' | 'warn' | 'error';       // default 'error'
  globs?: string[];                            // default []
}

export type PresetSource = 'bundled' | 'manual' | 'ai-generated' | 'imported';

/**
 * preset 元数据 + rule 列表。
 * 文件格式:`<name>.preset.json`
 *
 * source 决定它是谁造的:
 * - bundled = 仓库内置(只读,导出/编辑会拒绝)
 * - manual = 用户手动建
 * - ai-generated = 从 chat 生成
 * - imported = 从外部 file/URL 导入
 */
export interface Preset {
  id: string;                                  // 全局唯一 id,如 "ts-strict-personal"
  name: string;                                // 展示名,如 "我的 TS strict"
  description?: string;                       // default ''
  version?: string;                           // default '1.0'
  source?: PresetSource;                      // default 'manual'
  rules: PresetRuleConfig[];
  metadata?: {
    created_at?: string;                       // ISO 8601
    created_from?: string;                     // 自由文本,如 "chat:typescript strict mode"
    updated_at?: string;
  };
}

/**
 * preset 索引文件(per dir):列出目录下所有 preset。
 * 文件:`presets.json`(同 .checkit/presets/ 或 ~/.checkit/presets/)
 *
 * 不用每次 glob,索引持久化。`preset new` 增量写。
 */
export interface PresetIndexEntry {
  id: string;
  name: string;
  source: PresetSource;
  rule_count: number;
  file: string;                                // 相对索引文件路径
  updated_at?: string;
}

export interface PresetIndex {
  version: 1;
  presets: PresetIndexEntry[];
}

/** validate a parsed JSON blob looks like a Preset. Throws on bad shape. */
export function validatePreset(raw: unknown, file?: string): Preset {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Invalid preset${file ? ` (${file})` : ''}: not an object`);
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || r.id.length === 0) {
    throw new Error(`Invalid preset${file ? ` (${file})` : ''}: missing 'id'`);
  }
  if (typeof r.name !== 'string' || r.name.length === 0) {
    throw new Error(`Invalid preset ${r.id}: missing 'name'`);
  }
  if (!Array.isArray(r.rules)) {
    throw new Error(`Invalid preset ${r.id}: 'rules' must be an array`);
  }
  const rules: PresetRuleConfig[] = [];
  for (let i = 0; i < r.rules.length; i++) {
    const rr = r.rules[i] as Record<string, unknown>;
    if (typeof rr !== 'object' || rr === null) {
      throw new Error(`Invalid preset ${r.id}: rule[${i}] not an object`);
    }
    if (typeof rr.id !== 'string') {
      throw new Error(`Invalid preset ${r.id}: rule[${i}].id must be a string`);
    }
    const cfg: PresetRuleConfig = { id: rr.id };
    if (rr.enabled !== undefined) cfg.enabled = Boolean(rr.enabled);
    if (rr.threshold !== undefined) {
      if (rr.threshold !== 'off' && rr.threshold !== 'warn' && rr.threshold !== 'error') {
        throw new Error(`Invalid preset ${r.id}: rule[${i}].threshold must be off|warn|error`);
      }
      cfg.threshold = rr.threshold;
    }
    if (rr.globs !== undefined) {
      if (!Array.isArray(rr.globs) || !rr.globs.every((g) => typeof g === 'string')) {
        throw new Error(`Invalid preset ${r.id}: rule[${i}].globs must be string[]`);
      }
      cfg.globs = rr.globs as string[];
    }
    rules.push(cfg);
  }
  return {
    id: r.id,
    name: r.name,
    description: typeof r.description === 'string' ? r.description : '',
    version: typeof r.version === 'string' ? r.version : '1.0',
    source: (['bundled', 'manual', 'ai-generated', 'imported'] as const).includes(r.source as PresetSource)
      ? (r.source as PresetSource)
      : 'manual',
    rules,
    metadata: (typeof r.metadata === 'object' && r.metadata !== null) ? r.metadata as Preset['metadata'] : {},
  };
}

/** Normalize a Preset: fill defaults so downstream can rely on fields. */
export function normalizePreset(p: Preset): Preset {
  return {
    ...p,
    description: p.description ?? '',
    version: p.version ?? '1.0',
    source: p.source ?? 'manual',
    rules: p.rules.map((r) => ({
      enabled: true,
      threshold: 'error',
      globs: [],
      ...r,
    })),
    metadata: p.metadata ?? {},
  };
}
