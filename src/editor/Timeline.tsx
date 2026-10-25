import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Fragment } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { clipOutputMs, formatTime, totalDurationMs } from '@/lib/timeline';
import type { Project } from '@/state/types';
import { colors, radius, spacing } from '@/ui/theme';

const PX_PER_SECOND = 22;

type Props = {
  project: Project;
  selectedId?: string;
  onSelect: (id: string) => void;
  onTransitionPress: (id: string) => void;
  onAdd: () => void;
};

export function Timeline({ project, selectedId, onSelect, onTransitionPress, onAdd }: Props) {
  return (
    <View>
      <View style={styles.meta}>
        <Text style={styles.metaText}>
          {project.clips.length} clip{project.clips.length === 1 ? '' : 's'} · {formatTime(totalDurationMs(project))}
        </Text>
        <Text style={styles.metaText}>
          {project.texts.length} text · {project.audios.length} audio
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {project.clips.map((clip, i) => {
          const width = Math.max(56, (clipOutputMs(clip) / 1000) * PX_PER_SECOND);
          const selected = clip.id === selectedId;
          const hasTransition = clip.transitionOut.type !== 'none';
          return (
            <Fragment key={clip.id}>
              <Pressable
                accessibilityLabel={`Clip ${i + 1}`}
                onPress={() => onSelect(clip.id)}
                style={[styles.tile, { width }, selected && styles.tileSelected]}
              >
                {clip.thumbnail ? (
                  <Image source={{ uri: clip.thumbnail }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <Ionicons name={clip.type === 'image' ? 'image-outline' : 'film-outline'} size={20} color={colors.textMuted} />
                )}
                <View style={styles.badges}>
                  {clip.speed !== 1 || clip.ramp !== 'none' ? <Badge text={clip.ramp !== 'none' ? 'ramp' : `${clip.speed}x`} /> : null}
                  {clip.filter.preset !== 'none' ? <Badge text="fx" /> : null}
                  {clip.chroma.enabled ? <Badge text="key" /> : null}
                </View>
                <Text style={styles.duration}>{(clipOutputMs(clip) / 1000).toFixed(1)}s</Text>
              </Pressable>
              {(i < project.clips.length - 1 || hasTransition) && (
                <Pressable
                  accessibilityLabel={`Transition after clip ${i + 1}`}
                  hitSlop={6}
                  onPress={() => onTransitionPress(clip.id)}
                  style={[styles.transition, hasTransition && styles.transitionActive]}
                >
                  <Ionicons name={hasTransition ? 'swap-horizontal' : 'add'} size={12} color={hasTransition ? '#fff' : colors.textMuted} />
                </Pressable>
              )}
            </Fragment>
          );
        })}
        <Pressable accessibilityLabel="Add clips" onPress={onAdd} style={styles.add}>
          <Ionicons name="add" size={26} color={colors.text} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  metaText: { color: colors.textMuted, fontSize: 12 },
  strip: { alignItems: 'center', paddingVertical: 4 },
  tile: {
    height: 58,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileSelected: { borderColor: colors.accent },
  duration: {
    position: 'absolute',
    bottom: 2,
    right: 4,
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textShadowColor: '#000',
    textShadowRadius: 3,
  },
  badges: { position: 'absolute', top: 2, left: 2, flexDirection: 'row', gap: 2 },
  badge: { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  transition: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginHorizontal: -4,
    zIndex: 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transitionActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  add: {
    width: 58,
    height: 58,
    marginLeft: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
