export type ProgressEventPayload = {
  /** 0..1 */
  progress: number;
};

export type VideoEngineModuleEvents = {
  onProgress: (params: ProgressEventPayload) => void;
};

export type MediaInfo = {
  durationMs: number;
  width: number;
  height: number;
  hasAudio: boolean;
  hasVideo: boolean;
};

export type ExportResult = {
  uri: string;
  durationMs: number;
  sizeBytes: number;
};

// ---- Project format consumed by the native exporter (all times in ms) ----

export type SpeedPoint = { at: number; speed: number };

export type TransitionType = 'none' | 'fade' | 'fadeWhite' | 'wipe' | 'circle' | 'zoom' | 'slide';

export type EngineTransition = { type: TransitionType; durationMs: number };

export type EngineFilter = {
  preset: string;
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  vignette: number;
};

export type EngineChroma = {
  enabled: boolean;
  keyColor: string;
  similarity: number;
  smoothness: number;
  backgroundUri?: string;
  backgroundColor: string;
};

export type EngineClip = {
  uri: string;
  type: 'video' | 'image';
  /** Source-timeline trim range. For images, startMs = 0 and endMs = display duration. */
  startMs: number;
  endMs: number;
  speed: number;
  speedRamp?: SpeedPoint[];
  volume: number;
  denoise: boolean;
  filter: EngineFilter;
  chroma?: EngineChroma;
  transitionIn?: EngineTransition;
  transitionOut?: EngineTransition;
};

export type EngineText = {
  text: string;
  /** Output-timeline range. */
  startMs: number;
  endMs: number;
  /** Centre position as a fraction of the frame (0..1, y from top). */
  x: number;
  y: number;
  /** Text height as a fraction of the frame's short side. */
  size: number;
  /** #RRGGBB or #AARRGGBB */
  color: string;
  backgroundColor: string;
  bold: boolean;
  animation: 'none' | 'fade' | 'slideUp' | 'pop' | 'typewriter';
};

export type EngineAudioTrack = {
  uri: string;
  /** Output-timeline start. */
  startMs: number;
  /** Offset into the audio file. */
  trimStartMs: number;
  /** Length in the output timeline. */
  durationMs: number;
  volume: number;
  loop: boolean;
  fadeInMs: number;
  fadeOutMs: number;
  denoise: boolean;
};

export type EngineProject = {
  width: number;
  height: number;
  fit: 'fit' | 'crop' | 'stretch';
  clips: EngineClip[];
  texts: EngineText[];
  audioTracks: EngineAudioTrack[];
};
