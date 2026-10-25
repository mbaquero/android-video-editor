import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { pickClips } from '@/lib/media';
import { EMPTY_PROJECT, useProject } from '@/state/ProjectContext';
import { Button } from '@/ui/controls';
import { colors, radius, spacing } from '@/ui/theme';

const FEATURES: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string }[] = [
  { icon: 'cut-outline', title: 'Trim & split', body: 'Shorten clips, split at the playhead, delete the middle.' },
  { icon: 'albums-outline', title: 'Merge', body: 'Join videos and photos in any order.' },
  { icon: 'speedometer-outline', title: 'Speed', body: 'Slow-mo, fast-forward and speed ramps.' },
  { icon: 'text-outline', title: 'Text & captions', body: 'Animated titles, subtitles and .srt import.' },
  { icon: 'musical-notes-outline', title: 'Audio', body: 'Music, voiceovers, sound effects, volume and de-noise.' },
  { icon: 'color-filter-outline', title: 'Filters', body: 'Presets plus brightness, contrast, saturation, warmth.' },
  { icon: 'swap-horizontal-outline', title: 'Transitions & green screen', body: 'Fades, wipes, zooms and chroma key.' },
  { icon: 'crop-outline', title: 'Aspect ratio', body: '9:16, 1:1, 4:5 and 16:9 with fit or crop.' },
];

export default function Home() {
  const { project, dispatch } = useProject();
  const [loading, setLoading] = useState(false);

  const startNew = async () => {
    setLoading(true);
    try {
      const clips = await pickClips();
      if (clips.length === 0) return;
      dispatch({ type: 'reset', project: { ...EMPTY_PROJECT, clips } });
      router.push('/editor');
    } catch (e) {
      Alert.alert('Could not open media', String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Simple Video Editor</Text>
        <Text style={styles.subtitle}>Everyday edits, rendered on your phone.</Text>

        <View style={styles.actions}>
          {loading ? (
            <ActivityIndicator color={colors.accent} size="large" />
          ) : (
            <>
              <Button label="New project" icon="add-circle-outline" variant="primary" onPress={startNew} />
              {project.clips.length > 0 && (
                <Button
                  label={`Continue editing (${project.clips.length} clip${project.clips.length > 1 ? 's' : ''})`}
                  icon="play-forward-outline"
                  onPress={() => router.push('/editor')}
                />
              )}
            </>
          )}
        </View>

        <View style={styles.grid}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.card}>
              <Ionicons name={f.icon} size={22} color={colors.accent} />
              <Text style={styles.cardTitle}>{f.title}</Text>
              <Text style={styles.cardBody}>{f.body}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, gap: spacing.lg },
  title: { color: colors.text, fontSize: 30, fontWeight: '800', marginTop: spacing.xl },
  subtitle: { color: colors.textMuted, fontSize: 16, marginTop: -spacing.sm },
  actions: { gap: spacing.md, marginVertical: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  cardBody: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
});
