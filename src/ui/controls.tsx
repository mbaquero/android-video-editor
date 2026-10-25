import Ionicons from '@expo/vector-icons/Ionicons';
import Slider from '@react-native-community/slider';
import { ComponentProps, ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View, ViewStyle } from 'react-native';

import { colors, radius, spacing } from './theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function Button({
  label,
  icon,
  onPress,
  variant = 'secondary',
  disabled,
  style,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const fg = variant === 'primary' ? '#fff' : variant === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor: colors.accent, borderColor: colors.accent },
        variant === 'ghost' && { backgroundColor: 'transparent', borderColor: 'transparent' },
        pressed && { opacity: 0.75 },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={18} color={fg} />}
      <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  disabled,
  label,
  active,
}: {
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
  label: string;
  active?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, active && { backgroundColor: colors.accentSoft }, pressed && { opacity: 0.6 }, disabled && { opacity: 0.35 }]}
    >
      <Ionicons name={icon} size={22} color={active ? colors.accent : colors.text} />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.accent, borderColor: colors.accent }]}
    >
      <Text style={[styles.chipLabel, selected && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {options.map((o) => (
        <Chip key={String(o.value)} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
      ))}
    </ScrollView>
  );
}

/**
 * Slider that keeps its value locally while dragging and only commits on release,
 * so a drag produces one undo step instead of dozens.
 */
export function LabeledSlider({
  label,
  value,
  min,
  max,
  step = 0.01,
  format = (v) => v.toFixed(2),
  onChange,
  onLiveChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  onLiveChange?: (v: number) => void;
}) {
  const [local, setLocal] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setLocal(value);
  }
  return (
    <View style={styles.sliderBlock}>
      <View style={styles.sliderHeader}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{format(local)}</Text>
      </View>
      <Slider
        value={value}
        minimumValue={min}
        maximumValue={max}
        step={step}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.accent}
        onValueChange={(v) => {
          setLocal(v);
          onLiveChange?.(v);
        }}
        onSlidingComplete={onChange}
      />
    </View>
  );
}

export function ToggleRow({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {hint && <Text style={styles.hint}>{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor="#fff"
      />
    </View>
  );
}

export function Swatches({
  colors: options,
  value,
  onChange,
  allowNone,
}: {
  colors: string[];
  value: string;
  onChange: (c: string) => void;
  allowNone?: boolean;
}) {
  const all = allowNone ? ['transparent', ...options] : options;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {all.map((c) => (
        <Pressable
          key={c}
          accessibilityLabel={c === 'transparent' ? 'No colour' : `Colour ${c}`}
          onPress={() => onChange(c)}
          style={[
            styles.swatch,
            { backgroundColor: c === 'transparent' ? colors.surface : c },
            value.toLowerCase() === c.toLowerCase() && styles.swatchSelected,
          ]}
        >
          {c === 'transparent' && <Ionicons name="close" size={16} color={colors.textMuted} />}
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Hint({ children }: { children: ReactNode }) {
  return <Text style={styles.hint}>{children}</Text>;
}

export const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonLabel: { fontSize: 15, fontWeight: '600' },
  iconButton: { padding: spacing.sm, borderRadius: radius.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  chipLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  chipRow: { gap: spacing.sm, paddingVertical: 2 },
  sliderBlock: { marginTop: spacing.xs },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: -4 },
  label: { color: colors.text, fontSize: 14, fontWeight: '500' },
  value: { color: colors.textMuted, fontSize: 13, fontVariant: ['tabular-nums'] },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: { borderColor: colors.accent, transform: [{ scale: 1.1 }] },
  section: { gap: spacing.sm, marginBottom: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
