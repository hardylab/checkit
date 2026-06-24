'use client';
// View registry — maps view id to component. The single `app/page.tsx` reads
// from here so adding a new tab is a 3-line change (add id + import + entry).

import React from 'react';
import { DashboardView } from './DashboardView';
import { RulesView } from './RulesView';
import { RuleDetailView } from './RuleDetailView';
import { ChatView } from './ChatView';
import { AiFixView } from './AiFixView';

export type ViewId = 'dashboard' | 'rules' | 'rule-detail' | 'chat' | 'ai-fix';

export type ViewState =
  | { id: 'dashboard' }
  | { id: 'rules' }
  | { id: 'rule-detail'; ruleId: string }
  | { id: 'chat' }
  | { id: 'ai-fix'; idx: number; file: string };

export type NavigateFn = (next: ViewState) => void;

export function renderView(state: ViewState, navigate: NavigateFn): React.ReactNode {
  switch (state.id) {
    case 'dashboard':   return <DashboardView navigate={navigate} />;
    case 'rules':       return <RulesView navigate={navigate} />;
    case 'rule-detail': return <RuleDetailView ruleId={state.ruleId} navigate={navigate} />;
    case 'chat':        return <ChatView navigate={navigate} />;
    case 'ai-fix':      return <AiFixView idx={state.idx} file={state.file} navigate={navigate} />;
  }
}

// Tab metadata used by the Shell rail. The id here matches the top-level tab;
// `rule-detail` and `ai-fix` are sub-views that route to the parent tab.
export const RAIL_TABS: Array<{
  id: 'dashboard' | 'rules' | 'chat';
  view: ViewState;
  label: string;
}> = [
  { id: 'dashboard', view: { id: 'dashboard' }, label: '主控台' },
  { id: 'rules',     view: { id: 'rules' },     label: '规则市场' },
  { id: 'chat',      view: { id: 'chat' },      label: 'Chat' },
];
