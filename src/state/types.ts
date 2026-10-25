import type { EngineText, SpeedPoint, TransitionType } from '@modules/video-engine';

export type RampPreset = 'none' | 'montage' | 'hero' | 'bullet' | 'flashIn' | 'flashOut';

export type FilterSettings = {
  preset: string;
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  vignette: number;
};

export type ChromaSettings = {
  enabled: boolean;
  keyColor: string;
  similarity: number;
  smoothness: number;
  backgroundUri?: string;
  backgroundColor: string;
};

export type Transition = { type: TransitionType; durationMs: number };

export type Clip = {
  id: string;
  uri: string;
  type: 'video' | 'image';
  /** Full length of the source media (for images: the max adjustable duration). */
  sourceDurationMs: number;
  width: number;
  height: number;
  hasAudio: boolean;
  /** Trim range in the source timeline. For images startMs is 0 and endMs is the duration. */
  startMs: number;
  endMs: number;
  speed: number;
  ramp: RampPreset;
  volume: number;
  denoise: boolean;
  filter: FilterSettings;
  chroma: ChromaSettings;
  /** Transition into the next clip (or the outro when this is the last clip). */
  transitionOut: Transition;
  thumbnail?: string;
};

export type TextKind = 'title' | 'caption';

export type TextItem = Omit<EngineText, 'animation'> & {
  id: string;
  kind: TextKind;
  animation: EngineText['animation'];
};

export type AudioKind = 'music' | 'voiceover' | 'sfx';

export type AudioItem = {
  id: string;
  uri: string;
  name: string;
  kind: AudioKind;
  sourceDurationMs: number;
  startMs: number;
  trimStartMs: number;
  volume: number;
  loop: boolean;
  fadeIn: boolean;
  fadeOut: boolean;
  denoise: boolean;
};

export type AspectRatio = 'original' | '9:16' | '1:1' | '16:9' | '4:5';

export type Project = {
  clips: Clip[];
  texts: TextItem[];
  audios: AudioItem[];
  aspect: AspectRatio;
  fit: 'fit' | 'crop';
  resolution: 720 | 1080;
  intro: Transition;
};

export type { SpeedPoint, TransitionType };
