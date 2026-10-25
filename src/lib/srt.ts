export type SubtitleCue = { startMs: number; endMs: number; text: string };

const TIME = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;

function toMs(value: string): number | null {
  const m = TIME.exec(value);
  if (!m) return null;
  const [, h, min, s, frac] = m;
  return ((+h * 60 + +min) * 60 + +s) * 1000 + +frac.padEnd(3, '0');
}

/** Parses SubRip (.srt) or WebVTT (.vtt) subtitles. */
export function parseSubtitles(input: string): SubtitleCue[] {
  const blocks = input.replace(/\r/g, '').split(/\n{2,}/);
  const cues: SubtitleCue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim().length > 0);
    const timingIndex = lines.findIndex((l) => l.includes('-->'));
    if (timingIndex < 0) continue;
    const [from, to] = lines[timingIndex].split('-->');
    const startMs = toMs(from);
    const endMs = toMs(to);
    const text = lines
      .slice(timingIndex + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (startMs == null || endMs == null || endMs <= startMs || !text) continue;
    cues.push({ startMs, endMs, text });
  }
  return cues;
}

/** Splits a script into caption cues spread evenly over a duration (roughly by reading speed). */
export function scriptToCues(script: string, startMs: number, durationMs: number): SubtitleCue[] {
  const sentences = (script.match(/[^.!?\n]+[.!?]*/g) ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0 || durationMs <= 0) return [];
  const weights = sentences.map((s) => Math.max(1, s.split(/\s+/).length));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let cursor = startMs;
  return sentences.map((text, i) => {
    const length = (durationMs * weights[i]) / totalWeight;
    const cue = { startMs: cursor, endMs: cursor + length, text };
    cursor += length;
    return cue;
  });
}
