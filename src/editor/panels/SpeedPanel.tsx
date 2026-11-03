import { useT } from '@/i18n';
import { clipOutputMs, formatTime, RAMP_PRESETS } from '@/lib/timeline';
import type { RampPreset } from '@/state/types';
import { Button, ChipRow, Hint, LabeledSlider, Section } from '@/ui/controls';

import type { PanelProps } from './types';

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

export function SpeedPanel({ clip, dispatch }: PanelProps) {
  const { t } = useT();
  if (clip.type === 'image') {
    return <Hint>{t('speed.photoHint')}</Hint>;
  }
  const update = (patch: Partial<typeof clip>) => dispatch({ type: 'updateClip', id: clip.id, patch });
  const outMs = clipOutputMs(clip);

  return (
    <>
      <Section title={t('speed.constant')}>
        <ChipRow
          options={SPEEDS.map((s) => ({ value: s, label: `${s}x` }))}
          value={clip.ramp === 'none' ? clip.speed : -1}
          onChange={(s) => update({ speed: s, ramp: 'none' })}
        />
        <LabeledSlider
          label={t('speed.custom')}
          value={clip.speed}
          min={0.1}
          max={8}
          step={0.05}
          format={(v) => `${v.toFixed(2)}x`}
          onChange={(v) => update({ speed: Math.round(v * 100) / 100, ramp: 'none' })}
        />
      </Section>
      <Section title={t('speed.ramp')}>
        <ChipRow
          options={(Object.keys(RAMP_PRESETS) as RampPreset[]).map((k) => ({ value: k, label: k === 'none' ? t('common.none') : t(`ramp.${k}`) }))}
          value={clip.ramp}
          onChange={(ramp) => update({ ramp, speed: 1 })}
        />
        <Hint>{t('speed.rampHint')}</Hint>
      </Section>
      <Section title={t('speed.result')}>
        <Hint>{t('speed.resultLine', { source: formatTime(clip.endMs - clip.startMs), output: formatTime(outMs) })}</Hint>
        <Button label={t('speed.applyAll')} icon="layers-outline" onPress={() => dispatch({ type: 'updateAllClips', patch: { speed: clip.speed, ramp: clip.ramp } })} />
      </Section>
    </>
  );
}
