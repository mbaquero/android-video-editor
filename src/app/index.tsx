import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { pickClips } from '@/lib/media';
import { EMPTY_PROJECT, useProject } from '@/state/ProjectContext';
import { Button } from '@/ui/controls';
import { colors, radius, spacing } from '@/ui/theme';

const FEATURES = [
  { icon: 'cut-outline', id: 'trim' },
  { icon: 'albums-outline', id: 'merge' },
  { icon: 'speedometer-outline', id: 'speed' },
  { icon: 'text-outline', id: 'text' },
  { icon: 'musical-notes-outline', id: 'audio' },
  { icon: 'color-filter-outline', id: 'filters' },
  { icon: 'swap-horizontal-outline', id: 'transitions' },
  { icon: 'crop-outline', id: 'aspect' },
] as const satisfies readonly { icon: React.ComponentProps<typeof Ionicons>['name']; id: string }[];

export default function Home() {
  const { project, dispatch } = useProject();
  const [loading, setLoading] = useState(false);
  const { t, tn } = useT();

  const startNew = async () => {
    setLoading(true);
    try {
      const clips = await pickClips();
      if (clips.length === 0) return;
      dispatch({ type: 'reset', project: { ...EMPTY_PROJECT, clips } });
      router.push('/editor');
    } catch (e) {
      Alert.alert(t('home.openFailed'), String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Simple Video Editor</Text>
        <Text style={styles.subtitle}>{t('home.subtitle')}</Text>

        <View style={styles.actions}>
          {loading ? (
            <ActivityIndicator color={colors.accent} size="large" />
          ) : (
            <>
              <Button label={t('home.newProject')} icon="add-circle-outline" variant="primary" onPress={startNew} />
              {project.clips.length > 0 && (
                <Button
                  label={tn('home.continue', project.clips.length)}
                  icon="play-forward-outline"
                  onPress={() => router.push('/editor')}
                />
              )}
            </>
          )}
        </View>

        <View style={styles.grid}>
          {FEATURES.map((f) => (
            <View key={f.id} style={styles.card}>
              <Ionicons name={f.icon} size={22} color={colors.accent} />
              <Text style={styles.cardTitle}>{t(`feature.${f.id}.title`)}</Text>
              <Text style={styles.cardBody}>{t(`feature.${f.id}.body`)}</Text>
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
