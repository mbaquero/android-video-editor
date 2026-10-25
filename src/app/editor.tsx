import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { ComponentProps, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AudioPanel } from '@/editor/panels/AudioPanel';
import { EditPanel } from '@/editor/panels/EditPanel';
import { ChromaPanel, FilterPanel, FormatPanel, TransitionPanel } from '@/editor/panels/LookPanels';
import { SpeedPanel } from '@/editor/panels/SpeedPanel';
import { TextPanel } from '@/editor/panels/TextPanel';
import type { PanelProps } from '@/editor/panels/types';
import { Preview } from '@/editor/Preview';
import { Timeline } from '@/editor/Timeline';
import { pickClips } from '@/lib/media';
import { sourceToOutputMs } from '@/lib/timeline';
import { useProject } from '@/state/ProjectContext';
import { Button, IconButton } from '@/ui/controls';
import { colors, radius, spacing } from '@/ui/theme';

type Tool = 'edit' | 'speed' | 'text' | 'captions' | 'audio' | 'filters' | 'transitions' | 'chroma' | 'format';

const TOOLS: { id: Tool; label: string; icon: ComponentProps<typeof Ionicons>['name'] }[] = [
  { id: 'edit', label: 'Edit', icon: 'cut-outline' },
  { id: 'speed', label: 'Speed', icon: 'speedometer-outline' },
  { id: 'text', label: 'Text', icon: 'text-outline' },
  { id: 'captions', label: 'Captions', icon: 'chatbox-ellipses-outline' },
  { id: 'audio', label: 'Audio', icon: 'musical-notes-outline' },
  { id: 'filters', label: 'Filters', icon: 'color-filter-outline' },
  { id: 'transitions', label: 'Transitions', icon: 'swap-horizontal-outline' },
  { id: 'chroma', label: 'Green screen', icon: 'person-outline' },
  { id: 'format', label: 'Format', icon: 'crop-outline' },
];

export default function Editor() {
  const { project, dispatch, canUndo, canRedo } = useProject();
  const { height } = useWindowDimensions();
  const [selectedId, setSelectedId] = useState<string | undefined>(project.clips[0]?.id);
  const [tool, setTool] = useState<Tool>('edit');
  const [playheadMs, setPlayheadMs] = useState(0);

  // Falls back to the first clip if the selection disappeared (delete / undo).
  const clipIndex = Math.max(0, project.clips.findIndex((c) => c.id === selectedId));
  const clip = project.clips[clipIndex];

  // Reset the playhead to the clip start when switching clips.
  const [playheadClipId, setPlayheadClipId] = useState(clip?.id);
  if (clip && playheadClipId !== clip.id) {
    setPlayheadClipId(clip.id);
    setPlayheadMs(clip.startMs);
  }

  const addClips = async () => {
    try {
      const clips = await pickClips();
      if (clips.length) {
        dispatch({ type: 'addClips', clips });
        setSelectedId(clips[0].id);
      }
    } catch (e) {
      Alert.alert('Could not add media', String(e));
    }
  };

  if (!clip) {
    return (
      <SafeAreaView style={styles.empty} edges={['bottom']}>
        <Text style={styles.emptyText}>The timeline is empty.</Text>
        <Button label="Add videos or photos" icon="add" variant="primary" onPress={addClips} />
      </SafeAreaView>
    );
  }

  const outputPlayheadMs = sourceToOutputMs(project, clipIndex, playheadMs);
  const panelProps: PanelProps = {
    project,
    clip,
    clipIndex,
    playheadMs,
    outputPlayheadMs,
    dispatch,
    onSelectClip: setSelectedId,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerRight}>
              <IconButton icon="arrow-undo-outline" label="Undo" disabled={!canUndo} onPress={() => dispatch({ type: 'undo' })} />
              <IconButton icon="arrow-redo-outline" label="Redo" disabled={!canRedo} onPress={() => dispatch({ type: 'redo' })} />
              <IconButton icon="eye-outline" label="Render preview" onPress={() => router.push({ pathname: '/export', params: { preview: '1' } })} />
              <Pressable style={styles.exportButton} onPress={() => router.push('/export')}>
                <Text style={styles.exportLabel}>Export</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <View style={styles.top}>
        <Preview project={project} clipIndex={clipIndex} playheadMs={playheadMs} onPlayheadChange={setPlayheadMs} maxHeight={height * 0.34} />
        <Timeline
          project={project}
          selectedId={clip.id}
          onSelect={setSelectedId}
          onAdd={addClips}
          onTransitionPress={(id) => {
            setSelectedId(id);
            setTool('transitions');
          }}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolsScroll} contentContainerStyle={styles.tools}>
        {TOOLS.map((t) => {
          const active = t.id === tool;
          return (
            <Pressable key={t.id} onPress={() => setTool(t.id)} style={[styles.tool, active && styles.toolActive]} accessibilityRole="tab" accessibilityState={{ selected: active }}>
              <Ionicons name={t.icon} size={20} color={active ? colors.accent : colors.text} />
              <Text style={[styles.toolLabel, active && { color: colors.accent }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent} keyboardShouldPersistTaps="handled">
        {tool === 'edit' && <EditPanel {...panelProps} />}
        {tool === 'speed' && <SpeedPanel {...panelProps} />}
        {tool === 'text' && <TextPanel {...panelProps} kind="title" />}
        {tool === 'captions' && <TextPanel {...panelProps} kind="caption" />}
        {tool === 'audio' && <AudioPanel {...panelProps} />}
        {tool === 'filters' && <FilterPanel {...panelProps} />}
        {tool === 'transitions' && <TransitionPanel {...panelProps} />}
        {tool === 'chroma' && <ChromaPanel {...panelProps} />}
        {tool === 'format' && <FormatPanel {...panelProps} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  empty: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  emptyText: { color: colors.textMuted, fontSize: 16 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  exportButton: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7, marginLeft: 4 },
  exportLabel: { color: '#fff', fontWeight: '700' },
  top: { paddingHorizontal: spacing.md, gap: spacing.sm },
  toolsScroll: { flexGrow: 0, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
  tools: { paddingHorizontal: spacing.sm, paddingVertical: 6, gap: 4 },
  tool: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, minWidth: 64 },
  toolActive: { backgroundColor: colors.accentSoft },
  toolLabel: { color: colors.text, fontSize: 11, marginTop: 2, fontWeight: '600' },
  panel: { flex: 1 },
  panelContent: { padding: spacing.lg, paddingBottom: 48 },
});
