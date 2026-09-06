import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { ModalShell } from '@/components/ModalShell';

export function Field({ value, onChangeText, placeholder, secure, multiline, keyboardType }: { value: string; onChangeText: (value: string) => void; placeholder: string; secure?: boolean; multiline?: boolean; keyboardType?: 'default' | 'number-pad' }) {
  const colors = useColors();
  return <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.mutedForeground} autoCapitalize="none" autoCorrect={false} secureTextEntry={secure} multiline={multiline} keyboardType={keyboardType} style={[styles.input, multiline && styles.area, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]} />;
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{children}</Text>;
}

export function RadioOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useColors();
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.radio, pressed && styles.pressed]}><View style={[styles.radioOuter, { borderColor: selected ? colors.primary : colors.mutedForeground }]}>{selected ? <View style={[styles.radioInner, { backgroundColor: colors.primary }]} /> : null}</View><Text style={[styles.radioLabel, { color: colors.foreground }]}>{label}</Text></Pressable>;
}

export function SelectRow({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  return <>
    <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [styles.select, { backgroundColor: colors.secondary, borderColor: colors.border }, pressed && styles.pressed]}>
      <Text style={[styles.selectLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.selectValue, { color: colors.foreground }]}>{value}</Text>
      <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
    </Pressable>
    <ModalShell visible={open} title={label} onClose={() => setOpen(false)}>
      <View style={styles.optionList}>{options.map((option) => <Pressable key={option} onPress={() => { onChange(option); setOpen(false); }} style={({ pressed }) => [styles.option, { backgroundColor: option === value ? colors.accent : colors.secondary, borderColor: option === value ? colors.primary : colors.border }, pressed && styles.pressed]}><Text style={[styles.optionText, { color: colors.foreground }]}>{option}</Text>{option === value ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}</Pressable>)}</View>
    </ModalShell>
  </>;
}

export function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const colors = useColors();
  return <View style={styles.toggleRow}><Text style={[styles.toggleLabel, { color: colors.foreground }]}>{label}</Text><Switch value={value} onValueChange={onChange} trackColor={{ false: colors.secondary, true: colors.accent }} thumbColor={value ? colors.primary : colors.mutedForeground} /></View>;
}

export function ChipRow({ options, value, onChange }: { options: string[]; value: string; onChange: (value: string) => void }) {
  const colors = useColors();
  return <View style={styles.chips}>{options.map((option) => <Pressable key={option} onPress={() => onChange(option)} style={({ pressed }) => [styles.chip, { backgroundColor: option === value ? colors.primary : colors.secondary, borderColor: option === value ? colors.primary : colors.border }, pressed && styles.pressed]}><Text style={[styles.chipText, { color: option === value ? colors.primaryForeground : colors.foreground }]}>{option}</Text></Pressable>)}</View>;
}

const styles = StyleSheet.create({
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontFamily: 'Inter_400Regular', fontSize: 13, marginBottom: 10 },
  area: { minHeight: 110, textAlignVertical: 'top', paddingTop: 12 },
  fieldLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.4, marginBottom: 8, marginTop: 4 },
  radio: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 6, paddingRight: 10 },
  radioOuter: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 8, height: 8, borderRadius: 8 },
  radioLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.3 },
  select: { minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  selectLabel: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  selectValue: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13, textAlign: 'right' },
  optionList: { gap: 8, marginTop: 14 },
  option: { minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  toggleRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  toggleLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { minHeight: 32, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  pressed: { opacity: 0.7 },
});
