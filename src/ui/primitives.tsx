import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { theme } from './theme';

type TextTone = 'body' | 'heading' | 'muted' | 'caption';

export function AppText({ children, tone = 'body', style, ...props }: React.ComponentProps<typeof Text> & { tone?: TextTone }) {
  return <Text {...props} style={[styles.text, tone === 'heading' && styles.heading, tone === 'muted' && styles.muted, tone === 'caption' && styles.caption, style]}>{children}</Text>;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function AppButton({ label, variant = 'primary', icon, loading = false, style, textStyle, disabled, ...props }: Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  icon?: ReactNode;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}) {
  const inactive = disabled || loading;
  const foreground = variant === 'primary' || variant === 'danger' ? theme.surface : variant === 'secondary' ? theme.ink : theme.blue;
  return <Pressable {...props} accessibilityRole="button" accessibilityLabel={props.accessibilityLabel ?? label} accessibilityState={{ disabled: inactive, busy: loading }} disabled={inactive} style={({ pressed }) => [styles.button, variant === 'primary' && styles.primaryButton, variant === 'secondary' && styles.secondaryButton, variant === 'danger' && styles.dangerButton, pressed && !inactive && styles.pressed, inactive && styles.disabled, style]}>
    {loading ? <ActivityIndicator color={foreground} size="small" /> : icon}
    <AppText style={[styles.buttonText, { color: foreground }, textStyle]}>{label}</AppText>
  </Pressable>;
}

export function IconButton({ label, icon, style, ...props }: Omit<PressableProps, 'children' | 'style'> & { label: string; icon: ReactNode; style?: ViewStyle }) {
  return <Pressable {...props} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed, style]}>{icon}</Pressable>;
}

export function AppField({ label, hint, error, containerStyle, inputStyle, ...props }: TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}) {
  return <View style={[styles.field, containerStyle]}>
    <AppText style={styles.fieldLabel}>{label}</AppText>
    <TextInput {...props} accessibilityLabel={props.accessibilityLabel ?? label} placeholderTextColor={theme.placeholder} style={[styles.input, !!error && styles.inputError, inputStyle]} />
    {!!error && <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText>}
    {!error && !!hint && <AppText tone="caption" style={styles.hint}>{hint}</AppText>}
  </View>;
}

export function SurfaceCard({ children, style, ...props }: ViewProps & { children: ReactNode; style?: ViewStyle }) {
  return <View {...props} style={[styles.card, style]}>{children}</View>;
}

export function SegmentedTabs<T extends string>({ options, selected, onChange, style }: {
  options: readonly { value: T; label: string }[];
  selected: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
}) {
  return <View style={[styles.segments, style]} accessibilityRole="tablist">
    {options.map(option => {
      const active = option.value === selected;
      return <Pressable key={option.value} onPress={() => onChange(option.value)} accessibilityRole="tab" accessibilityLabel={option.label} accessibilityState={{ selected: active }} style={({ pressed }) => [styles.segment, active && styles.segmentActive, pressed && !active && styles.pressed]}>
        <AppText style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</AppText>
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  text: { color: theme.ink, fontFamily: theme.font.regular, fontSize: 16, lineHeight: 24 },
  heading: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 20, lineHeight: 28 },
  muted: { color: theme.muted },
  caption: { color: theme.muted, fontSize: 14, lineHeight: 21 },
  button: { minHeight: theme.touchTarget, borderRadius: theme.radius.xl, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  primaryButton: { backgroundColor: theme.blue, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.20)' },
  secondaryButton: { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
  dangerButton: { backgroundColor: theme.danger },
  buttonText: { fontFamily: theme.font.bold, fontSize: 16, lineHeight: 24 },
  iconButton: { width: theme.touchTarget, height: theme.touchTarget, borderRadius: theme.radius.lg, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
  field: { marginBottom: 16 },
  fieldLabel: { fontFamily: theme.font.semibold, color: theme.ink, fontSize: 16, marginBottom: 7 },
  input: { minHeight: 48, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radius.lg, backgroundColor: theme.surface, color: theme.ink, fontFamily: theme.font.regular, fontSize: 16, paddingHorizontal: 13, paddingVertical: 10 },
  inputError: { borderColor: theme.danger },
  error: { color: theme.danger, fontSize: 14, lineHeight: 21, marginTop: 5 },
  hint: { marginTop: 5 },
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radius.xl, padding: 16 },
  segments: { flexDirection: 'row', backgroundColor: theme.surfaceMuted, borderRadius: theme.radius.xl, padding: 4, gap: 4 },
  segment: { minHeight: theme.touchTarget, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 11, paddingHorizontal: 8 },
  segmentActive: { backgroundColor: theme.blue },
  segmentText: { fontFamily: theme.font.semibold, color: theme.muted, fontSize: 15, textAlign: 'center' },
  segmentTextActive: { color: theme.surface },
});
