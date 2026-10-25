import { Image } from 'expo-image';
import { Alert, StyleSheet, View } from 'react-native';

import { pickImage } from '@/lib/media';
import { DEFAULT_FILTER } from '@/state/ProjectContext';
import type { AspectRatio, FilterSettings, Transition, TransitionType } from '@/state/types';
import { Button, ChipRow, Hint, LabeledSlider, Row, Section, Swatches, ToggleRow } from '@/ui/controls';
import { radius } from '@/ui/theme';

import type { PanelProps } from './types';

const PRESETS = [
  ['none', 'Original'],
  ['vivid', 'Vivid'],
  ['warm', 'Warm'],
  ['cool', 'Cool'],
  ['cinematic', 'Cinematic'],
  ['vintage', 'Vintage'],
  ['fade', 'Faded'],
  ['mono', 'B&W'],
  ['noir', 'Noir'],
  ['sepia', 'Sepia'],
  ['invert', 'Invert'],
].map(([value, label]) => ({ value, label }));

const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}`;

export function FilterPanel({ clip, dispatch }: PanelProps) {
  const f = clip.filter;
  const set = (patch: Partial<FilterSettings>) => dispatch({ type: 'updateClip', id: clip.id, patch: { filter: { ...f, ...patch } } });
  return (
    <>
      <Section title="Preset">
        <ChipRow options={PRESETS} value={f.preset} onChange={(preset) => set({ preset })} />
      </Section>
      <Section title="Adjust">
        <LabeledSlider label="Brightness" value={f.brightness} min={-0.5} max={0.5} format={pct} onChange={(brightness) => set({ brightness })} />
        <LabeledSlider label="Contrast" value={f.contrast} min={-0.8} max={0.8} format={pct} onChange={(contrast) => set({ contrast })} />
        <LabeledSlider label="Saturation" value={f.saturation} min={-1} max={1} format={pct} onChange={(saturation) => set({ saturation })} />
        <LabeledSlider label="Warmth" value={f.warmth} min={-1} max={1} format={pct} onChange={(warmth) => set({ warmth })} />
        <LabeledSlider label="Vignette" value={f.vignette} min={0} max={1} format={pct} onChange={(vignette) => set({ vignette })} />
      </Section>
      <Row>
        <Button label="Apply to all clips" icon="layers-outline" onPress={() => dispatch({ type: 'updateAllClips', patch: { filter: f } })} />
        <Button label="Reset" icon="refresh" variant="ghost" onPress={() => set(DEFAULT_FILTER)} />
      </Row>
      <Hint>Colour changes are rendered on export — tap Preview to check the look.</Hint>
    </>
  );
}

const TRANSITIONS: { value: TransitionType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade (black)' },
  { value: 'fadeWhite', label: 'Flash (white)' },
  { value: 'wipe', label: 'Wipe' },
  { value: 'slide', label: 'Slide' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'circle', label: 'Circle' },
];

function TransitionEditor({ value, onChange, title }: { value: Transition; onChange: (t: Transition) => void; title: string }) {
  return (
    <Section title={title}>
      <ChipRow options={TRANSITIONS} value={value.type} onChange={(type) => onChange({ ...value, type })} />
      {value.type !== 'none' && (
        <LabeledSlider
          label="Duration"
          value={value.durationMs}
          min={200}
          max={2000}
          step={50}
          format={(v) => `${(v / 1000).toFixed(2)}s`}
          onChange={(durationMs) => onChange({ ...value, durationMs })}
        />
      )}
    </Section>
  );
}

export function TransitionPanel({ project, clip, clipIndex, dispatch }: PanelProps) {
  const isLast = clipIndex === project.clips.length - 1;
  return (
    <>
      {clipIndex === 0 && (
        <TransitionEditor title="Intro (start of video)" value={project.intro} onChange={(intro) => dispatch({ type: 'updateProject', patch: { intro } })} />
      )}
      <TransitionEditor
        title={isLast ? 'Outro (end of video)' : `Between clip ${clipIndex + 1} and ${clipIndex + 2}`}
        value={clip.transitionOut}
        onChange={(transitionOut) => dispatch({ type: 'updateClip', id: clip.id, patch: { transitionOut } })}
      />
      <Button
        label="Use this transition between all clips"
        icon="layers-outline"
        onPress={() =>
          project.clips.slice(0, -1).forEach((c) => dispatch({ type: 'updateClip', id: c.id, patch: { transitionOut: clip.transitionOut } }))
        }
      />
      <Hint>Transitions go through a colour or reveal effect, half on each clip, so the video length doesn&apos;t change.</Hint>
    </>
  );
}

const KEY_COLORS = ['#00FF00', '#00B140', '#0047BB', '#0000FF'];
const BG_COLORS = ['#000000', '#FFFFFF', '#FF5C7A', '#4DABF7', '#3DD68C', '#FFD43B'];

export function ChromaPanel({ clip, dispatch }: PanelProps) {
  const c = clip.chroma;
  const set = (patch: Partial<typeof c>) => dispatch({ type: 'updateClip', id: clip.id, patch: { chroma: { ...c, ...patch } } });
  const chooseBackground = async () => {
    try {
      const uri = await pickImage();
      if (uri) set({ backgroundUri: uri });
    } catch (e) {
      Alert.alert('Could not open image', String(e));
    }
  };
  return (
    <>
      <ToggleRow label="Green screen (chroma key)" hint="Replace a solid green or blue background." value={c.enabled} onChange={(enabled) => set({ enabled })} />
      {c.enabled && (
        <>
          <Section title="Key colour">
            <Swatches colors={KEY_COLORS} value={c.keyColor} onChange={(keyColor) => set({ keyColor })} />
            <LabeledSlider label="Strength" value={c.similarity} min={0.02} max={0.4} format={(v) => `${Math.round(v * 250)}`} onChange={(similarity) => set({ similarity })} />
            <LabeledSlider label="Edge softness" value={c.smoothness} min={0.01} max={0.3} format={(v) => `${Math.round(v * 333)}`} onChange={(smoothness) => set({ smoothness })} />
          </Section>
          <Section title="Replace with">
            {c.backgroundUri ? (
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Image source={{ uri: c.backgroundUri }} style={styles.bgThumb} contentFit="cover" />
                <Button label="Change" icon="image-outline" onPress={chooseBackground} />
                <Button label="Use colour" variant="ghost" onPress={() => set({ backgroundUri: undefined })} />
              </View>
            ) : (
              <>
                <Swatches colors={BG_COLORS} value={c.backgroundColor} onChange={(backgroundColor) => set({ backgroundColor })} />
                <Button label="Use a photo as background" icon="image-outline" onPress={chooseBackground} />
              </>
            )}
          </Section>
        </>
      )}
    </>
  );
}

const ASPECTS: { value: AspectRatio; label: string }[] = [
  { value: 'original', label: 'Original' },
  { value: '9:16', label: '9:16 Stories' },
  { value: '1:1', label: '1:1 Square' },
  { value: '4:5', label: '4:5 Portrait' },
  { value: '16:9', label: '16:9 Wide' },
];

export function FormatPanel({ project, dispatch }: PanelProps) {
  return (
    <>
      <Section title="Aspect ratio">
        <ChipRow options={ASPECTS} value={project.aspect} onChange={(aspect) => dispatch({ type: 'updateProject', patch: { aspect } })} />
      </Section>
      <Section title="Framing">
        <ChipRow
          options={[
            { value: 'fit', label: 'Fit (bars)' },
            { value: 'crop', label: 'Fill (crop)' },
          ]}
          value={project.fit}
          onChange={(fit) => dispatch({ type: 'updateProject', patch: { fit } })}
        />
        <Hint>Fit shows the whole frame with black bars; Fill crops to cover the frame.</Hint>
      </Section>
      <Section title="Resolution">
        <ChipRow
          options={[
            { value: 720, label: '720p' },
            { value: 1080, label: '1080p' },
          ]}
          value={project.resolution}
          onChange={(resolution) => dispatch({ type: 'updateProject', patch: { resolution } })}
        />
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  bgThumb: { width: 64, height: 64, borderRadius: radius.sm },
});
