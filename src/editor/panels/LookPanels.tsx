import { Image } from 'expo-image';
import { Alert, StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { pickImage } from '@/lib/media';
import { DEFAULT_FILTER } from '@/state/ProjectContext';
import type { AspectRatio, FilterSettings, Transition, TransitionType } from '@/state/types';
import { Button, ChipRow, Hint, LabeledSlider, Row, Section, Swatches, ToggleRow } from '@/ui/controls';
import { radius } from '@/ui/theme';

import type { PanelProps } from './types';

const PRESETS = ['none', 'vivid', 'warm', 'cool', 'cinematic', 'vintage', 'fade', 'mono', 'noir', 'sepia', 'invert'] as const;

const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}`;

export function FilterPanel({ clip, dispatch }: PanelProps) {
  const { t } = useT();
  const f = clip.filter;
  const set = (patch: Partial<FilterSettings>) => dispatch({ type: 'updateClip', id: clip.id, patch: { filter: { ...f, ...patch } } });
  return (
    <>
      <Section title={t('filter.preset')}>
        <ChipRow options={PRESETS.map((p) => ({ value: p as string, label: p === 'none' ? t('common.original') : t(`preset.${p}`) }))} value={f.preset} onChange={(preset) => set({ preset })} />
      </Section>
      <Section title={t('filter.adjust')}>
        <LabeledSlider label={t('filter.brightness')} value={f.brightness} min={-0.5} max={0.5} format={pct} onChange={(brightness) => set({ brightness })} />
        <LabeledSlider label={t('filter.contrast')} value={f.contrast} min={-0.8} max={0.8} format={pct} onChange={(contrast) => set({ contrast })} />
        <LabeledSlider label={t('filter.saturation')} value={f.saturation} min={-1} max={1} format={pct} onChange={(saturation) => set({ saturation })} />
        <LabeledSlider label={t('filter.warmth')} value={f.warmth} min={-1} max={1} format={pct} onChange={(warmth) => set({ warmth })} />
        <LabeledSlider label={t('filter.vignette')} value={f.vignette} min={0} max={1} format={pct} onChange={(vignette) => set({ vignette })} />
      </Section>
      <Row>
        <Button label={t('filter.applyAll')} icon="layers-outline" onPress={() => dispatch({ type: 'updateAllClips', patch: { filter: f } })} />
        <Button label={t('common.reset')} icon="refresh" variant="ghost" onPress={() => set(DEFAULT_FILTER)} />
      </Row>
      <Hint>{t('filter.hint')}</Hint>
    </>
  );
}

const TRANSITIONS = ['none', 'fade', 'fadeWhite', 'wipe', 'slide', 'zoom', 'circle'] as const satisfies readonly TransitionType[];

function TransitionEditor({ value, onChange, title }: { value: Transition; onChange: (transition: Transition) => void; title: string }) {
  const { t } = useT();
  return (
    <Section title={title}>
      <ChipRow options={TRANSITIONS.map((type) => ({ value: type, label: type === 'none' ? t('common.none') : t(`transition.${type}`) }))} value={value.type} onChange={(type) => onChange({ ...value, type })} />
      {value.type !== 'none' && (
        <LabeledSlider
          label={t('common.duration')}
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
  const { t } = useT();
  const isLast = clipIndex === project.clips.length - 1;
  return (
    <>
      {clipIndex === 0 && (
        <TransitionEditor title={t('transition.intro')} value={project.intro} onChange={(intro) => dispatch({ type: 'updateProject', patch: { intro } })} />
      )}
      <TransitionEditor
        title={isLast ? t('transition.outro') : t('transition.between', { a: clipIndex + 1, b: clipIndex + 2 })}
        value={clip.transitionOut}
        onChange={(transitionOut) => dispatch({ type: 'updateClip', id: clip.id, patch: { transitionOut } })}
      />
      <Button
        label={t('transition.applyAll')}
        icon="layers-outline"
        onPress={() =>
          project.clips.slice(0, -1).forEach((c) => dispatch({ type: 'updateClip', id: c.id, patch: { transitionOut: clip.transitionOut } }))
        }
      />
      <Hint>{t('transition.hint')}</Hint>
    </>
  );
}

const KEY_COLORS = ['#00FF00', '#00B140', '#0047BB', '#0000FF'];
const BG_COLORS = ['#000000', '#FFFFFF', '#FF5C7A', '#4DABF7', '#3DD68C', '#FFD43B'];

export function ChromaPanel({ clip, dispatch }: PanelProps) {
  const { t } = useT();
  const c = clip.chroma;
  const set = (patch: Partial<typeof c>) => dispatch({ type: 'updateClip', id: clip.id, patch: { chroma: { ...c, ...patch } } });
  const chooseBackground = async () => {
    try {
      const uri = await pickImage();
      if (uri) set({ backgroundUri: uri });
    } catch (e) {
      Alert.alert(t('chroma.openFailed'), String(e));
    }
  };
  return (
    <>
      <ToggleRow label={t('chroma.toggle')} hint={t('chroma.hint')} value={c.enabled} onChange={(enabled) => set({ enabled })} />
      {c.enabled && (
        <>
          <Section title={t('chroma.keyColour')}>
            <Swatches colors={KEY_COLORS} value={c.keyColor} onChange={(keyColor) => set({ keyColor })} />
            <LabeledSlider label={t('chroma.strength')} value={c.similarity} min={0.02} max={0.4} format={(v) => `${Math.round(v * 250)}`} onChange={(similarity) => set({ similarity })} />
            <LabeledSlider label={t('chroma.softness')} value={c.smoothness} min={0.01} max={0.3} format={(v) => `${Math.round(v * 333)}`} onChange={(smoothness) => set({ smoothness })} />
          </Section>
          <Section title={t('chroma.replace')}>
            {c.backgroundUri ? (
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Image source={{ uri: c.backgroundUri }} style={styles.bgThumb} contentFit="cover" />
                <Button label={t('chroma.change')} icon="image-outline" onPress={chooseBackground} />
                <Button label={t('chroma.useColour')} variant="ghost" onPress={() => set({ backgroundUri: undefined })} />
              </View>
            ) : (
              <>
                <Swatches colors={BG_COLORS} value={c.backgroundColor} onChange={(backgroundColor) => set({ backgroundColor })} />
                <Button label={t('chroma.usePhoto')} icon="image-outline" onPress={chooseBackground} />
              </>
            )}
          </Section>
        </>
      )}
    </>
  );
}

const ASPECTS = ['original', '9:16', '1:1', '4:5', '16:9'] as const satisfies readonly AspectRatio[];

export function FormatPanel({ project, dispatch }: PanelProps) {
  const { t } = useT();
  return (
    <>
      <Section title={t('format.aspect')}>
        <ChipRow options={ASPECTS.map((a) => ({ value: a, label: a === 'original' ? t('common.original') : t(`aspect.${a}`) }))} value={project.aspect} onChange={(aspect) => dispatch({ type: 'updateProject', patch: { aspect } })} />
      </Section>
      <Section title={t('format.framing')}>
        <ChipRow
          options={[
            { value: 'fit', label: t('format.fit') },
            { value: 'crop', label: t('format.crop') },
          ]}
          value={project.fit}
          onChange={(fit) => dispatch({ type: 'updateProject', patch: { fit } })}
        />
        <Hint>{t('format.hint')}</Hint>
      </Section>
      <Section title={t('format.resolution')}>
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
