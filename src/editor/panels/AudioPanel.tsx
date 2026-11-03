import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n';
import { audioItemFromUri, pickAudio } from '@/lib/media';
import { formatTime, totalDurationMs } from '@/lib/timeline';
import type { AudioItem, AudioKind } from '@/state/types';
import { Button, Hint, LabeledSlider, Row, Section, ToggleRow } from '@/ui/controls';
import { colors, radius, spacing } from '@/ui/theme';

import type { PanelProps } from './types';

const KIND_ICON: Record<AudioKind, React.ComponentProps<typeof Ionicons>['name']> = {
  music: 'musical-notes',
  voiceover: 'mic',
  sfx: 'flash',
};

export function AudioPanel({ project, outputPlayheadMs, dispatch }: PanelProps) {
  const { t } = useT();
  const total = totalDurationMs(project);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [recordStartMs, setRecordStartMs] = useState(0);

  const add = async (kind: AudioKind) => {
    try {
      const item = await pickAudio(kind, outputPlayheadMs);
      if (item) dispatch({ type: 'addAudio', audio: item });
    } catch (e) {
      Alert.alert(t('audio.addFailed'), String(e));
    }
  };

  const toggleRecording = async () => {
    try {
      if (recorderState.isRecording) {
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        if (recorder.uri) {
          const item = await audioItemFromUri(recorder.uri, t('audio.voiceoverName', { time: formatTime(recordStartMs) }), 'voiceover', recordStartMs);
          dispatch({ type: 'addAudio', audio: item });
        }
        return;
      }
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('audio.micTitle'), t('audio.micBody'));
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      setRecordStartMs(outputPlayheadMs);
      await recorder.prepareToRecordAsync({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' });
      recorder.record();
    } catch (e) {
      Alert.alert(t('audio.recordFailed'), String(e));
    }
  };

  return (
    <>
      <Section title={t('audio.add')}>
        <Row>
          <Button label={t('audio.music')} icon="musical-notes-outline" onPress={() => add('music')} />
          <Button label={t('audio.sfx')} icon="flash-outline" onPress={() => add('sfx')} />
          <Button
            label={recorderState.isRecording ? t('audio.stop', { time: formatTime(recorderState.durationMillis) }) : t('audio.record')}
            icon={recorderState.isRecording ? 'stop-circle' : 'mic-outline'}
            variant={recorderState.isRecording ? 'danger' : 'secondary'}
            onPress={toggleRecording}
          />
        </Row>
        <Hint>{t('audio.hint', { time: formatTime(outputPlayheadMs) })}</Hint>
      </Section>

      {project.audios.length === 0 && <Hint>{t('audio.empty')}</Hint>}
      {project.audios.map((a) => (
        <AudioTrackEditor key={a.id} audio={a} total={total} dispatch={dispatch} />
      ))}
    </>
  );
}

function AudioTrackEditor({ audio, total, dispatch }: { audio: AudioItem; total: number; dispatch: PanelProps['dispatch'] }) {
  const { t } = useT();
  const update = (patch: Partial<AudioItem>) => dispatch({ type: 'updateAudio', id: audio.id, patch });
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name={KIND_ICON[audio.kind]} size={18} color={colors.accent} />
        <Text style={styles.name} numberOfLines={1}>
          {audio.name}
        </Text>
        <Text style={styles.meta}>{formatTime(audio.sourceDurationMs)}</Text>
      </View>
      <LabeledSlider label={t('common.volume')} value={audio.volume} min={0} max={2} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(volume) => update({ volume })} />
      {!audio.loop && (
        <LabeledSlider label={t('audio.startsAt')} value={audio.startMs} min={0} max={Math.max(total, 1)} step={50} format={formatTime} onChange={(startMs) => update({ startMs })} />
      )}
      {audio.sourceDurationMs > 1000 && (
        <LabeledSlider
          label={t('audio.skip')}
          value={audio.trimStartMs}
          min={0}
          max={Math.max(0, audio.sourceDurationMs - 500)}
          step={100}
          format={formatTime}
          onChange={(trimStartMs) => update({ trimStartMs })}
        />
      )}
      <ToggleRow label={t('audio.loop')} value={audio.loop} onChange={(loop) => update({ loop })} />
      <ToggleRow label={t('audio.fadeIn')} value={audio.fadeIn} onChange={(fadeIn) => update({ fadeIn })} />
      <ToggleRow label={t('audio.fadeOut')} value={audio.fadeOut} onChange={(fadeOut) => update({ fadeOut })} />
      <ToggleRow label={t('common.reduceNoise')} value={audio.denoise} onChange={(denoise) => update({ denoise })} />
      <Button label={t('common.remove')} icon="trash-outline" variant="danger" onPress={() => dispatch({ type: 'removeAudio', id: audio.id })} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1, color: colors.text, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 12 },
});
