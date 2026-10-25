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
  const total = totalDurationMs(project);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [recordStartMs, setRecordStartMs] = useState(0);

  const add = async (kind: AudioKind) => {
    try {
      const item = await pickAudio(kind, outputPlayheadMs);
      if (item) dispatch({ type: 'addAudio', audio: item });
    } catch (e) {
      Alert.alert('Could not add audio', String(e));
    }
  };

  const toggleRecording = async () => {
    try {
      if (recorderState.isRecording) {
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        if (recorder.uri) {
          const item = await audioItemFromUri(recorder.uri, `Voiceover ${formatTime(recordStartMs)}`, 'voiceover', recordStartMs);
          dispatch({ type: 'addAudio', audio: item });
        }
        return;
      }
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microphone needed', 'Allow microphone access to record a voiceover.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      setRecordStartMs(outputPlayheadMs);
      await recorder.prepareToRecordAsync({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' });
      recorder.record();
    } catch (e) {
      Alert.alert('Recording failed', String(e));
    }
  };

  return (
    <>
      <Section title="Add audio">
        <Row>
          <Button label="Music" icon="musical-notes-outline" onPress={() => add('music')} />
          <Button label="Sound effect" icon="flash-outline" onPress={() => add('sfx')} />
          <Button
            label={recorderState.isRecording ? `Stop (${formatTime(recorderState.durationMillis)})` : 'Record voiceover'}
            icon={recorderState.isRecording ? 'stop-circle' : 'mic-outline'}
            variant={recorderState.isRecording ? 'danger' : 'secondary'}
            onPress={toggleRecording}
          />
        </Row>
        <Hint>
          Sound effects and voiceovers start at the playhead ({formatTime(outputPlayheadMs)}). Music loops under the whole video by default.
        </Hint>
      </Section>

      {project.audios.length === 0 && <Hint>No audio tracks yet. Clip audio volume and noise reduction live in the Edit tool.</Hint>}
      {project.audios.map((a) => (
        <AudioTrackEditor key={a.id} audio={a} total={total} dispatch={dispatch} />
      ))}
    </>
  );
}

function AudioTrackEditor({ audio, total, dispatch }: { audio: AudioItem; total: number; dispatch: PanelProps['dispatch'] }) {
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
      <LabeledSlider label="Volume" value={audio.volume} min={0} max={2} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(volume) => update({ volume })} />
      {!audio.loop && (
        <LabeledSlider label="Starts at" value={audio.startMs} min={0} max={Math.max(total, 1)} step={50} format={formatTime} onChange={(startMs) => update({ startMs })} />
      )}
      {audio.sourceDurationMs > 1000 && (
        <LabeledSlider
          label="Skip into file"
          value={audio.trimStartMs}
          min={0}
          max={Math.max(0, audio.sourceDurationMs - 500)}
          step={100}
          format={formatTime}
          onChange={(trimStartMs) => update({ trimStartMs })}
        />
      )}
      <ToggleRow label="Loop to fill the video" value={audio.loop} onChange={(loop) => update({ loop })} />
      <ToggleRow label="Fade in" value={audio.fadeIn} onChange={(fadeIn) => update({ fadeIn })} />
      <ToggleRow label="Fade out" value={audio.fadeOut} onChange={(fadeOut) => update({ fadeOut })} />
      <ToggleRow label="Reduce noise" value={audio.denoise} onChange={(denoise) => update({ denoise })} />
      <Button label="Remove" icon="trash-outline" variant="danger" onPress={() => dispatch({ type: 'removeAudio', id: audio.id })} />
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
