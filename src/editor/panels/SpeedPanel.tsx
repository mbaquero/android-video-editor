import { clipOutputMs, formatTime, RAMP_PRESETS } from '@/lib/timeline';
import type { RampPreset } from '@/state/types';
import { Button, ChipRow, Hint, LabeledSlider, Section } from '@/ui/controls';

import type { PanelProps } from './types';

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

export function SpeedPanel({ clip, dispatch }: PanelProps) {
  if (clip.type === 'image') {
    return <Hint>Speed applies to video clips. Change a photo&apos;s length from the Edit tool.</Hint>;
  }
  const update = (patch: Partial<typeof clip>) => dispatch({ type: 'updateClip', id: clip.id, patch });
  const outMs = clipOutputMs(clip);

  return (
    <>
      <Section title="Constant speed">
        <ChipRow
          options={SPEEDS.map((s) => ({ value: s, label: `${s}x` }))}
          value={clip.ramp === 'none' ? clip.speed : -1}
          onChange={(s) => update({ speed: s, ramp: 'none' })}
        />
        <LabeledSlider
          label="Custom"
          value={clip.speed}
          min={0.1}
          max={8}
          step={0.05}
          format={(v) => `${v.toFixed(2)}x`}
          onChange={(v) => update({ speed: Math.round(v * 100) / 100, ramp: 'none' })}
        />
      </Section>
      <Section title="Speed ramp">
        <ChipRow
          options={(Object.keys(RAMP_PRESETS) as RampPreset[]).map((k) => ({ value: k, label: RAMP_PRESETS[k].label }))}
          value={clip.ramp}
          onChange={(ramp) => update({ ramp, speed: 1 })}
        />
        <Hint>
          Ramps smoothly change speed across the clip — e.g. Hero slows to 0.25x in the middle. Audio follows the speed.
        </Hint>
      </Section>
      <Section title="Result">
        <Hint>
          Source {formatTime(clip.endMs - clip.startMs)} → output {formatTime(outMs)}
        </Hint>
        <Button label="Apply this speed to all clips" icon="layers-outline" onPress={() => dispatch({ type: 'updateAllClips', patch: { speed: clip.speed, ramp: clip.ramp } })} />
      </Section>
    </>
  );
}
