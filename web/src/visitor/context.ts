import { createContext, useContext } from 'react';
import type { LiveClient } from './live';
import type { MusicController } from './music';

export type VisitorState = Record<string, any> & {
  step: 'welcome' | 'letter' | 'game' | 'exchange' | 'correct' | 'message' | 'gallery' | 'end';
  progress: Record<string, any>;
};

export interface VisitorCtx {
  state: VisitorState;
  /** Replace state with what the server returned after an action. */
  apply: (s: VisitorState) => void;
  reload: () => Promise<void>;
  /** Logical page for music, tips and presence ('welcome', 'letter', …, 'confession'). */
  setPage: (p: string) => void;
  page: string;
  music: MusicController;
  live: LiveClient;
}

export const Ctx = createContext<VisitorCtx | null>(null);

export function useVisitor() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useVisitor outside VisitorShell');
  return v;
}

/** For components that are also rendered in admin previews (outside the visitor shell). */
export const useVisitorMaybe = () => useContext(Ctx);
