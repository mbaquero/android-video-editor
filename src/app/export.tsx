import { useEvent } from 'expo';
import { useKeepAwake } from 'expo-keep-awake';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { shareAsync } from 'expo-sharing';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import VideoEngine, { ExportResult } from '@modules/video-engine';

import { formatTime, outputSize, toEngineProject } from '@/lib/timeline';
import { useProject } from '@/state/ProjectContext';
import { Button } from '@/ui/controls';
import { colors, radius, spacing } from '@/ui/theme';

type Status = 'rendering' | 'done' | 'error';

export default function ExportScreen() {
  useKeepAwake();
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  const isPreview = preview === '1';
  const { project } = useProject();
  const [status, setStatus] = useState<Status>('rendering');
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<ExportResult>();
  const [saved, setSaved] = useState(false);
  const { progress } = useEvent(VideoEngine, 'onProgress', { progress: 0 });
  const started = useRef(false);
  const player = useVideoPlayer(null, (p) => {
    p.loop = true;
  });

  const render = async () => {
    setStatus('rendering');
    setError(undefined);
    try {
      // Previews render at 480p so they come back quickly.
      const engineProject = toEngineProject(isPreview ? { ...project, resolution: 720 } : project);
      if (isPreview) {
        const scale = 480 / Math.min(engineProject.width, engineProject.height);
        engineProject.width = Math.round((engineProject.width * scale) / 2) * 2;
        engineProject.height = Math.round((engineProject.height * scale) / 2) * 2;
      }
      const res = await VideoEngine.exportAsync(JSON.stringify(engineProject));
      setResult(res);
      setStatus('done');
      await player.replaceAsync(res.uri);
      player.play();
    } catch (e: any) {
      if (e?.code === 'ERR_CANCELLED') return;
      setError(e?.message ?? String(e));
      setStatus('error');
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    render();
    return () => {
      VideoEngine.cancelExportAsync();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!result) return;
    try {
      const permission = await requestPermissionsAsync(true);
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow access to your gallery to save the video.');
        return;
      }
      await Asset.create(result.uri);
      setSaved(true);
    } catch (e) {
      Alert.alert('Could not save', String(e));
    }
  };

  const { width, height } = isPreview ? { width: 0, height: 0 } : outputSize(project);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: isPreview ? 'Preview' : 'Export' }} />
      {status === 'rendering' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.big}>{Math.round(progress * 100)}%</Text>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.muted}>{isPreview ? 'Rendering a quick 480p preview…' : `Rendering ${width}×${height} MP4…`}</Text>
          <Text style={styles.muted}>Keep the app open until it finishes.</Text>
          <Button
            label="Cancel"
            variant="ghost"
            onPress={() => {
              VideoEngine.cancelExportAsync();
              router.back();
            }}
          />
        </View>
      )}

      {status === 'error' && (
        <View style={styles.center}>
          <Text style={styles.big}>Export failed</Text>
          <Text style={styles.muted}>{error}</Text>
          <Button label="Try again" icon="refresh" variant="primary" onPress={render} />
        </View>
      )}

      {status === 'done' && result && (
        <View style={styles.done}>
          <View style={styles.videoBox}>
            <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls />
          </View>
          <Text style={styles.muted}>
            {formatTime(result.durationMs)} · {(result.sizeBytes / 1024 / 1024).toFixed(1)} MB
          </Text>
          {isPreview ? (
            <Button label="Back to editor" icon="arrow-back" variant="primary" onPress={() => router.back()} />
          ) : (
            <View style={styles.actions}>
              <Button label={saved ? 'Saved to gallery' : 'Save to gallery'} icon={saved ? 'checkmark-circle' : 'download-outline'} variant="primary" disabled={saved} onPress={save} />
              <Button label="Share" icon="share-social-outline" onPress={() => shareAsync(result.uri, { mimeType: 'video/mp4' })} />
              <Button label="Keep editing" icon="create-outline" variant="ghost" onPress={() => router.back()} />
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  big: { color: colors.text, fontSize: 28, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  bar: { width: '80%', height: 6, borderRadius: 3, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.accent },
  done: { flex: 1, padding: spacing.lg, gap: spacing.md },
  videoBox: { flex: 1, backgroundColor: '#000', borderRadius: radius.lg, overflow: 'hidden' },
  actions: { gap: spacing.sm },
});
