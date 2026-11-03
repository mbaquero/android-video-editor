import { Alert, I18nManager } from 'react-native';

import { useT } from '@/i18n';
import { MAX_IMAGE_MS } from '@/lib/media';
import { formatTime } from '@/lib/timeline';
import { Button, Hint, LabeledSlider, Row, Section, ToggleRow } from '@/ui/controls';

import type { PanelProps } from './types';

const MIN_MS = 100;

export function EditPanel({ project, clip, clipIndex, playheadMs, dispatch, onSelectClip }: PanelProps) {
  const update = (patch: Partial<typeof clip>) => dispatch({ type: 'updateClip', id: clip.id, patch });
  const isImage = clip.type === 'image';
  const { t } = useT();
  const rtl = I18nManager.isRTL;
  const fmt = (ms: number) => formatTime(ms);

  const remove = () => {
    Alert.alert(t('edit.deleteTitle'), t('edit.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          const next = project.clips[clipIndex + 1] ?? project.clips[clipIndex - 1];
          dispatch({ type: 'removeClip', id: clip.id });
          onSelectClip(next?.id);
        },
      },
    ]);
  };

  return (
    <>
      <Section title={t('edit.trim')}>
        {isImage ? (
          <LabeledSlider
            label={t('edit.photoDuration')}
            value={clip.endMs}
            min={500}
            max={MAX_IMAGE_MS}
            step={100}
            format={fmt}
            onChange={(v) => update({ endMs: v })}
          />
        ) : (
          <>
            <LabeledSlider
              label={t('edit.start')}
              value={clip.startMs}
              min={0}
              max={clip.sourceDurationMs}
              step={10}
              format={fmt}
              onChange={(v) => update({ startMs: Math.min(v, clip.endMs - MIN_MS) })}
            />
            <LabeledSlider
              label={t('edit.end')}
              value={clip.endMs}
              min={0}
              max={clip.sourceDurationMs}
              step={10}
              format={fmt}
              onChange={(v) => update({ endMs: Math.max(v, clip.startMs + MIN_MS) })}
            />
            <Row>
              <Button
                label={t('edit.startAtPlayhead')}
                icon={rtl ? 'arrow-back' : 'arrow-forward'}
                onPress={() => update({ startMs: Math.min(playheadMs, clip.endMs - MIN_MS) })}
              />
              <Button
                label={t('edit.endAtPlayhead')}
                icon={rtl ? 'arrow-forward' : 'arrow-back'}
                onPress={() => update({ endMs: Math.max(playheadMs, clip.startMs + MIN_MS) })}
              />
            </Row>
          </>
        )}
      </Section>

      <Section title={t('edit.cut')}>
        <Row>
          <Button label={t('edit.split')} icon="cut" variant="primary" onPress={() => dispatch({ type: 'splitClip', id: clip.id, atSourceMs: playheadMs })} />
          <Button label={t('edit.duplicate')} icon="copy-outline" onPress={() => dispatch({ type: 'duplicateClip', id: clip.id })} />
        </Row>
        <Hint>{t('edit.cutHint')}</Hint>
      </Section>

      <Section title={t('edit.arrange')}>
        <Row>
          <Button label={t('edit.moveEarlier')} icon={rtl ? 'chevron-forward' : 'chevron-back'} disabled={clipIndex === 0} onPress={() => dispatch({ type: 'moveClip', id: clip.id, delta: -1 })} />
          <Button
            label={t('edit.moveLater')}
            icon={rtl ? 'chevron-back' : 'chevron-forward'}
            disabled={clipIndex === project.clips.length - 1}
            onPress={() => dispatch({ type: 'moveClip', id: clip.id, delta: 1 })}
          />
          <Button label={t('common.delete')} icon="trash-outline" variant="danger" onPress={remove} />
        </Row>
      </Section>

      {!isImage && (
        <Section title={t('edit.clipAudio')}>
          {clip.hasAudio ? (
            <>
              <LabeledSlider
                label={t('common.volume')}
                value={clip.volume}
                min={0}
                max={2}
                step={0.05}
                format={(v) => (v === 0 ? t('edit.muted') : `${Math.round(v * 100)}%`)}
                onChange={(v) => update({ volume: v })}
              />
              <Row>
                <Button label={clip.volume === 0 ? t('edit.unmute') : t('edit.mute')} icon={clip.volume === 0 ? 'volume-high-outline' : 'volume-mute-outline'} onPress={() => update({ volume: clip.volume === 0 ? 1 : 0 })} />
              </Row>
              <ToggleRow label={t('common.reduceNoise')} hint={t('edit.denoiseHint')} value={clip.denoise} onChange={(v) => update({ denoise: v })} />
            </>
          ) : (
            <Hint>{t('edit.noAudio')}</Hint>
          )}
        </Section>
      )}
    </>
  );
}
