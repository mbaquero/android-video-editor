import { createContext, ReactNode, useContext, useMemo, useReducer } from 'react';

import type { AudioItem, Clip, FilterSettings, Project, TextItem } from './types';

export const DEFAULT_FILTER: FilterSettings = {
  preset: 'none',
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  vignette: 0,
};

export const EMPTY_PROJECT: Project = {
  clips: [],
  texts: [],
  audios: [],
  aspect: 'original',
  fit: 'fit',
  resolution: 1080,
  intro: { type: 'none', durationMs: 600 },
};

let idCounter = 0;
export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${idCounter++}`;

export function createClip(
  input: Pick<Clip, 'uri' | 'type' | 'sourceDurationMs' | 'width' | 'height' | 'hasAudio'> &
    Partial<Clip>,
): Clip {
  return {
    id: newId('clip'),
    startMs: 0,
    endMs: input.sourceDurationMs,
    speed: 1,
    ramp: 'none',
    volume: 1,
    denoise: false,
    filter: DEFAULT_FILTER,
    chroma: {
      enabled: false,
      keyColor: '#00FF00',
      similarity: 0.12,
      smoothness: 0.08,
      backgroundColor: '#000000',
    },
    transitionOut: { type: 'none', durationMs: 600 },
    ...input,
  };
}

type Action =
  | { type: 'reset'; project: Project }
  | { type: 'addClips'; clips: Clip[] }
  | { type: 'updateClip'; id: string; patch: Partial<Clip> }
  | { type: 'updateAllClips'; patch: Partial<Clip> }
  | { type: 'removeClip'; id: string }
  | { type: 'duplicateClip'; id: string }
  | { type: 'moveClip'; id: string; delta: number }
  | { type: 'splitClip'; id: string; atSourceMs: number }
  | { type: 'addText'; text: TextItem }
  | { type: 'updateText'; id: string; patch: Partial<TextItem> }
  | { type: 'removeText'; id: string }
  | { type: 'addAudio'; audio: AudioItem }
  | { type: 'updateAudio'; id: string; patch: Partial<AudioItem> }
  | { type: 'removeAudio'; id: string }
  | { type: 'updateProject'; patch: Partial<Pick<Project, 'aspect' | 'fit' | 'resolution' | 'intro'>> }
  | { type: 'undo' }
  | { type: 'redo' };

type History = { past: Project[]; present: Project; future: Project[] };

const MIN_CLIP_MS = 100;
const HISTORY_LIMIT = 50;

function apply(p: Project, action: Action): Project {
  switch (action.type) {
    case 'reset':
      return action.project;
    case 'addClips':
      return { ...p, clips: [...p.clips, ...action.clips] };
    case 'updateClip':
      return {
        ...p,
        clips: p.clips.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)),
      };
    case 'updateAllClips':
      return { ...p, clips: p.clips.map((c) => ({ ...c, ...action.patch })) };
    case 'removeClip':
      return { ...p, clips: p.clips.filter((c) => c.id !== action.id) };
    case 'duplicateClip': {
      const i = p.clips.findIndex((c) => c.id === action.id);
      if (i < 0) return p;
      const clips = [...p.clips];
      clips.splice(i + 1, 0, { ...p.clips[i], id: newId('clip') });
      return { ...p, clips };
    }
    case 'moveClip': {
      const i = p.clips.findIndex((c) => c.id === action.id);
      const j = i + action.delta;
      if (i < 0 || j < 0 || j >= p.clips.length) return p;
      const clips = [...p.clips];
      [clips[i], clips[j]] = [clips[j], clips[i]];
      return { ...p, clips };
    }
    case 'splitClip': {
      const i = p.clips.findIndex((c) => c.id === action.id);
      const clip = p.clips[i];
      if (!clip) return p;
      const at = action.atSourceMs;
      if (clip.type === 'image') {
        // Images split by duration: both halves show the same picture.
        if (at <= MIN_CLIP_MS || at >= clip.endMs - MIN_CLIP_MS) return p;
        const first = { ...clip, endMs: at, transitionOut: { ...clip.transitionOut, type: 'none' as const } };
        const second = { ...clip, id: newId('clip'), startMs: 0, endMs: clip.endMs - at };
        const clips = [...p.clips];
        clips.splice(i, 1, first, second);
        return { ...p, clips };
      }
      if (at <= clip.startMs + MIN_CLIP_MS || at >= clip.endMs - MIN_CLIP_MS) return p;
      const first = { ...clip, endMs: at, transitionOut: { ...clip.transitionOut, type: 'none' as const } };
      const second = { ...clip, id: newId('clip'), startMs: at };
      const clips = [...p.clips];
      clips.splice(i, 1, first, second);
      return { ...p, clips };
    }
    case 'addText':
      return { ...p, texts: [...p.texts, action.text] };
    case 'updateText':
      return {
        ...p,
        texts: p.texts.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)),
      };
    case 'removeText':
      return { ...p, texts: p.texts.filter((t) => t.id !== action.id) };
    case 'addAudio':
      return { ...p, audios: [...p.audios, action.audio] };
    case 'updateAudio':
      return {
        ...p,
        audios: p.audios.map((a) => (a.id === action.id ? { ...a, ...action.patch } : a)),
      };
    case 'removeAudio':
      return { ...p, audios: p.audios.filter((a) => a.id !== action.id) };
    case 'updateProject':
      return { ...p, ...action.patch };
    default:
      return p;
  }
}

function reducer(state: History, action: Action): History {
  if (action.type === 'undo') {
    const previous = state.past[state.past.length - 1];
    if (!previous) return state;
    return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] };
  }
  if (action.type === 'redo') {
    const [next, ...rest] = state.future;
    if (!next) return state;
    return { past: [...state.past, state.present], present: next, future: rest };
  }
  const present = apply(state.present, action);
  if (present === state.present) return state;
  if (action.type === 'reset') return { past: [], present, future: [] };
  return { past: [...state.past, state.present].slice(-HISTORY_LIMIT), present, future: [] };
}

type ContextValue = {
  project: Project;
  dispatch: (action: Action) => void;
  canUndo: boolean;
  canRedo: boolean;
};

const ProjectContext = createContext<ContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { past: [], present: EMPTY_PROJECT, future: [] });
  const value = useMemo(
    () => ({
      project: state.present,
      dispatch,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
    }),
    [state],
  );
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used inside ProjectProvider');
  return ctx;
}
