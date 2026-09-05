import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const colors = useColors();
  const Wrapper = scroll ? require('react-native').ScrollView : View;
  return (
    <Wrapper style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={scroll ? styles.screenContent : undefined} showsVerticalScrollIndicator={false}>
      {children}
    </Wrapper>
  );
}

export function Header({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action?: string; onAction?: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      <View>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow.toUpperCase()}</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      </View>
      {action && onAction ? <Pressable onPress={onAction} hitSlop={12} style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}><Text style={[styles.headerActionText, { color: colors.mutedForeground }]}>{action}</Text></Pressable> : null}
    </View>
  );
}

export function Surface({ children, style }: { children: React.ReactNode; style?: object }) {
  const colors = useColors();
  return <View style={[styles.surface, { backgroundColor: colors.card, borderColor: colors.border }, style]}>{children}</View>;
}

export function Label({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return <Text style={[styles.label, { color: colors.mutedForeground }]}>{children}</Text>;
}

export function IconButton({ icon, onPress, label }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; label?: string }) {
  const colors = useColors();
  return <Pressable accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}><Ionicons name={icon} size={20} color={colors.foreground} /></Pressable>;
}

export function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'red' | 'green' | 'amber' }) {
  const colors = useColors();
  const tint = tone === 'red' ? colors.primary : tone === 'green' ? colors.success : tone === 'amber' ? colors.warning : colors.mutedForeground;
  return <View style={[styles.pill, { backgroundColor: tone === 'red' ? colors.accent : colors.secondary }]}><View style={[styles.dot, { backgroundColor: tint }]} /><Text style={[styles.pillText, { color: tint }]}>{children}</Text></View>;
}

export function Row({ icon, title, subtitle, right, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void }) {
  const colors = useColors();
  const content = <><View style={[styles.rowIcon, { backgroundColor: colors.secondary }]}><Ionicons name={icon} size={18} color={colors.primary} /></View><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: colors.foreground }]}>{title}</Text>{subtitle ? <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}</View>{right}</>;
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>{content}</Pressable> : <View style={styles.row}>{content}</View>;
}

export function PrimaryButton({ title, icon, onPress, disabled = false, secondary = false }: { title: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  const colors = useColors();
  return <Pressable testID={title} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, { backgroundColor: secondary ? colors.secondary : colors.primary, borderColor: secondary ? colors.border : colors.primary }, disabled && { opacity: 0.45 }, pressed && styles.pressed]}>{icon ? <Ionicons name={icon} size={17} color={secondary ? colors.foreground : colors.primaryForeground} /> : null}<Text style={[styles.primaryButtonText, { color: secondary ? colors.foreground : colors.primaryForeground }]}>{title}</Text></Pressable>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1 },
  screenContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.8, marginBottom: 6 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 30, letterSpacing: -0.8 },
  headerAction: { paddingBottom: 4 },
  headerActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  surface: { borderWidth: 1, borderRadius: 22, padding: 18 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  iconButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pill: { alignSelf: 'flex-start', flexDirection: 'row', gap: 7, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 99 },
  dot: { width: 6, height: 6, borderRadius: 6 },
  pillText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 66, gap: 12 },
  rowIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1 },
  rowTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  rowSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  primaryButton: { minHeight: 52, borderRadius: 17, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 20 },
  primaryButtonText: { fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 0.2 },
  pressed: { opacity: 0.7 },
});
