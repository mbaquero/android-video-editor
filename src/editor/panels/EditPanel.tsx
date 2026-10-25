import { Alert } from 'react-native';

import { MAX_IMAGE_MS } from '@/lib/media';
import { formatTime } from '@/lib/timeline';
import { Button, Hint, LabeledSlider, Row, Section, ToggleRow } from '@/ui/controls';

import type { PanelProps } from './types';

const MIN_MS = 100;

export function EditPanel({ project, clip, clipIndex, playheadMs, dispatch, onSelectClip }: PanelProps) {
  const update = (patch: Partial<typeof clip>) => dispatch({ type: 'updateClip', id: clip.id, patch });
  const isImage = clip.type === 'image';
  const fmt = (ms: number) => formatTime(ms);

  const remove = () => {
    Alert.alert('Delete clip?', 'This removes the clip from the timeline.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
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
      <Section title="Trim">
        {isImage ? (
          <LabeledSlider
            label="Photo duration"
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
              label="Start"
              value={clip.startMs}
              min={0}
              max={clip.sourceDurationMs}
              step={10}
              format={fmt}
              onChange={(v) => update({ startMs: Math.min(v, clip.endMs - MIN_MS) })}
            />
            <LabeledSlider
              label="End"
              value={clip.endMs}
              min={0}
              max={clip.sourceDurationMs}
              step={10}
              format={fmt}
              onChange={(v) => update({ endMs: Math.max(v, clip.startMs + MIN_MS) })}
            />
            <Row>
              <Button
                label="Start at playhead"
                icon="arrow-forward"
                onPress={() => update({ startMs: Math.min(playheadMs, clip.endMs - MIN_MS) })}
              />
              <Button
                label="End at playhead"
                icon="arrow-back"
                onPress={() => update({ endMs: Math.max(playheadMs, clip.startMs + MIN_MS) })}
              />
            </Row>
          </>
        )}
      </Section>

      <Section title="Cut">
        <Row>
          <Button label="Split at playhead" icon="cut" variant="primary" onPress={() => dispatch({ type: 'splitClip', id: clip.id, atSourceMs: playheadMs })} />
          <Button label="Duplicate" icon="copy-outline" onPress={() => dispatch({ type: 'duplicateClip', id: clip.id })} />
        </Row>
        <Hint>To remove a middle section: split at its start and end, then delete the piece in between.</Hint>
      </Section>

      <Section title="Arrange">
        <Row>
          <Button label="Move left" icon="chevron-back" disabled={clipIndex === 0} onPress={() => dispatch({ type: 'moveClip', id: clip.id, delta: -1 })} />
          <Button
            label="Move right"
            icon="chevron-forward"
            disabled={clipIndex === project.clips.length - 1}
            onPress={() => dispatch({ type: 'moveClip', id: clip.id, delta: 1 })}
          />
          <Button label="Delete" icon="trash-outline" variant="danger" onPress={remove} />
        </Row>
      </Section>

      {!isImage && (
        <Section title="Clip audio">
          {clip.hasAudio ? (
            <>
              <LabeledSlider
                label="Volume"
                value={clip.volume}
                min={0}
                max={2}
                step={0.05}
                format={(v) => (v === 0 ? 'Muted' : `${Math.round(v * 100)}%`)}
                onChange={(v) => update({ volume: v })}
              />
              <Row>
                <Button label={clip.volume === 0 ? 'Unmute' : 'Mute'} icon={clip.volume === 0 ? 'volume-high-outline' : 'volume-mute-outline'} onPress={() => update({ volume: clip.volume === 0 ? 1 : 0 })} />
              </Row>
              <ToggleRow label="Reduce noise" hint="Removes rumble and quiets background hiss between sounds." value={clip.denoise} onChange={(v) => update({ denoise: v })} />
            </>
          ) : (
            <Hint>This clip has no audio track.</Hint>
          )}
        </Section>
      )}
    </>
  );
}
