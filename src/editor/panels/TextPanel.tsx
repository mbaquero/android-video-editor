import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { pickTextFile } from '@/lib/media';
import { parseSubtitles, scriptToCues } from '@/lib/srt';
import { formatTime, totalDurationMs } from '@/lib/timeline';
import { newId } from '@/state/ProjectContext';
import type { TextItem, TextKind } from '@/state/types';
import { Button, ChipRow, Hint, LabeledSlider, Row, Section, Swatches, ToggleRow } from '@/ui/controls';
import { colors, radius, spacing, SWATCHES } from '@/ui/theme';

import type { PanelProps } from './types';

const ANIMATIONS: { value: TextItem['animation']; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'slideUp', label: 'Slide up' },
  { value: 'pop', label: 'Pop' },
  { value: 'typewriter', label: 'Typewriter' },
];

const POSITIONS = [
  { value: 'top', label: 'Top', y: 0.14 },
  { value: 'center', label: 'Center', y: 0.5 },
  { value: 'lower', label: 'Lower third', y: 0.72 },
  { value: 'bottom', label: 'Bottom', y: 0.86 },
] as const;

// Engine colours use Android's #AARRGGBB.
const CAPTION_BOXES = ['transparent', '#99000000', '#E6000000', '#CCFFFFFF', '#E6FF5C7A', '#E6FFD43B'];

function defaults(kind: TextKind, startMs: number, total: number): TextItem {
  const caption = kind === 'caption';
  return {
    id: newId('text'),
    kind,
    text: caption ? 'Caption' : 'Your title',
    startMs,
    endMs: Math.min(total, startMs + (caption ? 2500 : 3000)),
    x: 0.5,
    y: caption ? 0.84 : 0.5,
    size: caption ? 0.05 : 0.09,
    color: '#FFFFFF',
    backgroundColor: caption ? '#99000000' : 'transparent',
    bold: true,
    animation: caption ? 'none' : 'pop',
  };
}

export function TextPanel({ project, outputPlayheadMs, dispatch, kind }: PanelProps & { kind: TextKind }) {
  const total = totalDurationMs(project);
  const items = project.texts.filter((t) => t.kind === kind).sort((a, b) => a.startMs - b.startMs);
  const [editingId, setEditingId] = useState<string | undefined>(items[0]?.id);
  const [script, setScript] = useState('');
  const editing = project.texts.find((t) => t.id === editingId);

  const add = () => {
    const item = defaults(kind, Math.min(outputPlayheadMs, Math.max(0, total - 500)), total);
    dispatch({ type: 'addText', text: item });
    setEditingId(item.id);
  };

  const addCues = (cues: { startMs: number; endMs: number; text: string }[]) => {
    if (cues.length === 0) {
      Alert.alert('No captions found', 'The file or script did not contain any caption lines.');
      return;
    }
    const style = editing ?? defaults('caption', 0, total);
    for (const cue of cues) {
      dispatch({ type: 'addText', text: { ...style, id: newId('text'), kind: 'caption', ...cue } });
    }
  };

  const importFile = async () => {
    try {
      const content = await pickTextFile();
      if (content != null) addCues(parseSubtitles(content));
    } catch (e) {
      Alert.alert('Import failed', String(e));
    }
  };

  return (
    <>
      <Section title={kind === 'caption' ? 'Captions' : 'Titles'} right={<Button label="Add at playhead" icon="add" variant="primary" onPress={add} />}>
        {items.length === 0 && (
          <Hint>{kind === 'caption' ? 'Add subtitle lines, import an .srt/.vtt file or paste a script below.' : 'Add a title, then style and animate it.'}</Hint>
        )}
        {items.map((t) => (
          <Pressable key={t.id} onPress={() => setEditingId(t.id)} style={[styles.item, t.id === editingId && styles.itemSelected]}>
            <Text style={styles.itemText} numberOfLines={1}>
              {t.text || '(empty)'}
            </Text>
            <Text style={styles.itemTime}>
              {formatTime(t.startMs)}–{formatTime(t.endMs)}
            </Text>
          </Pressable>
        ))}
      </Section>

      {editing && <TextEditor item={editing} total={total} dispatch={dispatch} onDelete={() => setEditingId(undefined)} applyStyleToAll={kind === 'caption' ? items : undefined} />}

      {kind === 'caption' && (
        <Section title="Bulk captions">
          <Row>
            <Button label="Import .srt / .vtt" icon="document-text-outline" onPress={importFile} />
          </Row>
          <TextInput
            value={script}
            onChangeText={setScript}
            placeholder="Paste a script — each sentence becomes a caption, timed across the whole video."
            placeholderTextColor={colors.textMuted}
            multiline
            style={[styles.input, { minHeight: 80 }]}
          />
          <Button
            label="Create captions from script"
            icon="sparkles-outline"
            disabled={!script.trim()}
            onPress={() => {
              addCues(scriptToCues(script, 0, total));
              setScript('');
            }}
          />
        </Section>
      )}
    </>
  );
}

function TextEditor({
  item,
  total,
  dispatch,
  onDelete,
  applyStyleToAll,
}: {
  item: TextItem;
  total: number;
  dispatch: PanelProps['dispatch'];
  onDelete: () => void;
  applyStyleToAll?: TextItem[];
}) {
  const update = (patch: Partial<TextItem>) => dispatch({ type: 'updateText', id: item.id, patch });
  const [draft, setDraft] = useState(item.text);
  const [draftId, setDraftId] = useState(item.id);
  if (draftId !== item.id) {
    setDraftId(item.id);
    setDraft(item.text);
  }

  return (
    <Section title="Edit">
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onEndEditing={() => draft !== item.text && update({ text: draft })}
        onBlur={() => draft !== item.text && update({ text: draft })}
        multiline
        style={styles.input}
        placeholder="Text"
        placeholderTextColor={colors.textMuted}
      />
      <LabeledSlider label="Starts" value={item.startMs} min={0} max={Math.max(total, 1)} step={50} format={formatTime} onChange={(v) => update({ startMs: Math.min(v, item.endMs - 100) })} />
      <LabeledSlider label="Ends" value={item.endMs} min={0} max={Math.max(total, 1)} step={50} format={formatTime} onChange={(v) => update({ endMs: Math.max(v, item.startMs + 100) })} />

      <Text style={styles.label}>Position</Text>
      <ChipRow
        options={POSITIONS.map((p) => ({ value: p.value as string, label: p.label }))}
        value={POSITIONS.find((p) => Math.abs(p.y - item.y) < 0.01 && item.x === 0.5)?.value ?? ''}
        onChange={(v) => update({ x: 0.5, y: POSITIONS.find((p) => p.value === v)!.y })}
      />
      <LabeledSlider label="Horizontal" value={item.x} min={0.05} max={0.95} format={(v) => `${Math.round(v * 100)}%`} onChange={(x) => update({ x })} />
      <LabeledSlider label="Vertical" value={item.y} min={0.05} max={0.95} format={(v) => `${Math.round(v * 100)}%`} onChange={(y) => update({ y })} />
      <LabeledSlider label="Size" value={item.size} min={0.02} max={0.2} step={0.005} format={(v) => `${Math.round(v * 1000) / 10}`} onChange={(size) => update({ size })} />

      <Text style={styles.label}>Colour</Text>
      <Swatches colors={SWATCHES} value={item.color} onChange={(color) => update({ color })} />
      <Text style={styles.label}>Background box</Text>
      <Swatches colors={CAPTION_BOXES.slice(1)} allowNone value={item.backgroundColor} onChange={(backgroundColor) => update({ backgroundColor })} />
      <ToggleRow label="Bold" value={item.bold} onChange={(bold) => update({ bold })} />

      <Text style={styles.label}>Animation</Text>
      <ChipRow options={ANIMATIONS} value={item.animation} onChange={(animation) => update({ animation })} />

      <Row style={{ marginTop: spacing.sm }}>
        {applyStyleToAll && applyStyleToAll.length > 1 && (
          <Button
            label="Apply style to all captions"
            icon="color-wand-outline"
            onPress={() =>
              applyStyleToAll.forEach((t) =>
                dispatch({
                  type: 'updateText',
                  id: t.id,
                  patch: { x: item.x, y: item.y, size: item.size, color: item.color, backgroundColor: item.backgroundColor, bold: item.bold, animation: item.animation },
                }),
              )
            }
          />
        )}
        <Button
          label="Delete"
          icon="trash-outline"
          variant="danger"
          onPress={() => {
            dispatch({ type: 'removeText', id: item.id });
            onDelete();
          }}
        />
      </Row>
    </Section>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemSelected: { borderColor: colors.accent },
  itemText: { flex: 1, color: colors.text, fontWeight: '600' },
  itemTime: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  input: {
    color: colors.text,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  label: { color: colors.text, fontSize: 14, fontWeight: '500', marginTop: spacing.xs },
});
