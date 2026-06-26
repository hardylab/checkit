// packages/backend/src/workspace/schema.ts — workspace data shape.
//
// A "workspace" is a named, user-defined scope that bundles:
//   - one or more project root directories (cwd entries to scan)
//   - one or more presets (rulesets) to apply during scan
//
// Workspaces live as JSON files in ~/.checkit/workspaces/<id>.json
// (per-user, not per-project — they cross project boundaries).
//
// Presets that reference this workspace live in their own files
// (`ai.used_in_workspaces: [<id>, ...]` field); we don't track
// reverse-lookups here — that's computed at read time.

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  /** Project root directories to scan (absolute paths). */
  roots: string[];
  /** Preset ids to apply during scan. */
  presetIds: string[];
  /** When the workspace was last scanned (ISO timestamp) or undefined. */
  lastScannedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type WorkspaceScope = 'global' | 'project';
