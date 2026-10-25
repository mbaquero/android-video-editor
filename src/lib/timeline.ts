import type { EngineClip, EngineProject, SpeedPoint } from '@modules/video-engine';

import type { Clip, Project, RampPreset } from '@/state/types';

export const RAMP_PRESETS: Record<RampPreset, { label: string; points: SpeedPoint[] }> = {
  none: { label: 'None', points: [] },
  montage: {
    label: 'Montage',
    points: [
      { at: 0, speed: 1 },
      { at: 0.3, speed: 2.5 },
      { at: 0.5, speed: 0.5 },
      { at: 0.7, speed: 2.5 },
      { at: 1, speed: 1 },
    ],
  },
  hero: {
    label: 'Hero',
    points: [
      { at: 0, speed: 1 },
      { at: 0.35, speed: 1 },
      { at: 0.5, speed: 0.25 },
      { at: 0.65, speed: 1 },
      { at: 1, speed: 1 },
    ],
  },
  bullet: {
    label: 'Bullet',
    points: [
      { at: 0, speed: 2 },
      { at: 0.4, speed: 2 },
      { at: 0.5, speed: 0.2 },
      { at: 0.6, speed: 2 },
      { at: 1, speed: 2 },
    ],
  },
  flashIn: {
    label: 'Flash in',
    points: [
      { at: 0, speed: 4 },
      { at: 0.3, speed: 1 },
      { at: 1, speed: 1 },
    ],
  },
  flashOut: {
    label: 'Flash out',
    points: [
      { at: 0, speed: 1 },
      { at: 0.7, speed: 1 },
      { at: 1, speed: 4 },
    ],
  },
};

const RAMP_SEGMENT_MS = 100;

function interpolate(points: SpeedPoint[], at: number): number {
  if (at <= points[0].at) return points[0].speed;
  const last = points[points.length - 1];
  if (at >= last.at) return last.speed;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (at >= a.at && at <= b.at) {
      const span = b.at - a.at;
      return span > 0 ? a.speed + ((b.speed - a.speed) * (at - a.at)) / span : b.speed;
    }
  }
  return last.speed;
}

const clampSpeed = (s: number) => Math.min(8, Math.max(0.1, s));

/**
 * Output length of a clip after trim + speed. Mirrors CompositionFactory.outputDurationMs on
 * the native side so text/audio timing lines up with the exported file.
 */
export function clipOutputMs(clip: Clip): number {
  const source = clip.endMs - clip.startMs;
  if (clip.type === 'image') return source;
  const points = RAMP_PRESETS[clip.ramp].points;
  if (points.length < 2) return source / clampSpeed(clip.speed);
  let out = 0;
  for (let t = 0; t < source; t += RAMP_SEGMENT_MS) {
    const end = Math.min(source, t + RAMP_SEGMENT_MS);
    const mid = Math.min(t + RAMP_SEGMENT_MS / 2, source) / source;
    out += (end - t) / clampSpeed(interpolate(points, mid));
  }
  return out;
}

export function clipStartsMs(project: Project): number[] {
  const starts: number[] = [];
  let acc = 0;
  for (const clip of project.clips) {
    starts.push(acc);
    acc += clipOutputMs(clip);
  }
  return starts;
}

export function totalDurationMs(project: Project): number {
  return project.clips.reduce((sum, c) => sum + clipOutputMs(c), 0);
}

/** Maps a position in a clip's source timeline to the project output timeline. */
export function sourceToOutputMs(project: Project, clipIndex: number, sourceMs: number): number {
  const clip = project.clips[clipIndex];
  if (!clip) return 0;
  const start = clipStartsMs(project)[clipIndex];
  const within = Math.min(Math.max(sourceMs - clip.startMs, 0), clip.endMs - clip.startMs);
  const fraction = clip.endMs > clip.startMs ? within / (clip.endMs - clip.startMs) : 0;
  return start + clipOutputMs(clip) * fraction;
}

export function outputSize(project: Project): { width: number; height: number; ratio: number } {
  const first = project.clips[0];
  const ratio =
    project.aspect === 'original'
      ? first && first.width > 0 && first.height > 0
        ? first.width / first.height
        : 9 / 16
      : (() => {
          const [w, h] = project.aspect.split(':').map(Number);
          return w / h;
        })();
  const short = project.resolution;
  const even = (v: number) => Math.round(v / 2) * 2;
  return ratio >= 1
    ? { width: even(short * ratio), height: short, ratio }
    : { width: short, height: even(short / ratio), ratio };
}

/** Converts the editor model into the format the native exporter consumes. */
export function toEngineProject(project: Project): EngineProject {
  const { width, height } = outputSize(project);
  const total = totalDurationMs(project);
  const clips: EngineClip[] = project.clips.map((clip, i) => {
    const prev = i > 0 ? project.clips[i - 1] : undefined;
    const isLast = i === project.clips.length - 1;
    const outputMs = clipOutputMs(clip);
    // Transitions between clips are split: the outgoing clip plays the first half,
    // the incoming clip the second half.
    const half = (ms: number) => Math.round(Math.min(ms / 2, outputMs / 2));
    const transitionIn =
      i === 0
        ? project.intro.type !== 'none'
          ? { type: project.intro.type, durationMs: Math.min(project.intro.durationMs, outputMs / 2) }
          : undefined
        : prev && prev.transitionOut.type !== 'none'
          ? { type: prev.transitionOut.type, durationMs: half(prev.transitionOut.durationMs) }
          : undefined;
    const transitionOut =
      clip.transitionOut.type !== 'none'
        ? {
            type: clip.transitionOut.type,
            durationMs: isLast
              ? Math.min(clip.transitionOut.durationMs, outputMs / 2)
              : half(clip.transitionOut.durationMs),
          }
        : undefined;
    const ramp = RAMP_PRESETS[clip.ramp].points;
    return {
      uri: clip.uri,
      type: clip.type,
      startMs: Math.round(clip.startMs),
      endMs: Math.round(clip.endMs),
      speed: clip.speed,
      speedRamp: ramp.length >= 2 ? ramp : undefined,
      volume: clip.hasAudio ? clip.volume : 0,
      denoise: clip.denoise,
      filter: clip.filter,
      chroma: clip.chroma.enabled ? clip.chroma : undefined,
      transitionIn,
      transitionOut,
    };
  });

  return {
    width,
    height,
    fit: project.fit,
    clips,
    texts: project.texts
      .filter((t) => t.text.trim().length > 0 && t.startMs < total)
      .map(({ id: _id, kind: _kind, ...t }) => ({
        ...t,
        startMs: Math.round(t.startMs),
        endMs: Math.round(Math.min(t.endMs, total)),
      })),
    audioTracks: project.audios
      .filter((a) => a.startMs < total)
      .map((a) => {
        // Looping tracks always start at 0 (a looping sequence would repeat its leading gap).
        const startMs = a.loop ? 0 : Math.round(a.startMs);
        const available = a.loop ? Infinity : a.sourceDurationMs - a.trimStartMs;
        const durationMs = Math.max(1, Math.round(Math.min(total - startMs, available)));
        return {
          uri: a.uri,
          startMs,
          trimStartMs: Math.round(a.trimStartMs),
          durationMs,
          volume: a.volume,
          loop: a.loop,
          fadeInMs: a.fadeIn ? Math.min(1500, durationMs / 3) : 0,
          fadeOutMs: a.fadeOut ? Math.min(2000, durationMs / 3) : 0,
          denoise: a.denoise,
        };
      }),
  };
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, ms) / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
