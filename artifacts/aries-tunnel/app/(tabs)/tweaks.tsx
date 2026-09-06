import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Header, Label, Pill, Screen, Surface } from '@/components/Primitives';
import { useAppState } from '@/context/AppStateContext';
import { useColors } from '@/hooks/useColors';

export default function ConfigsScreen() {
  const colors = useColors();
  const { configs, selectedConfigId, selectConfig } = useAppState();
  return <Screen>
    <Header eyebrow="Selection" title="Configs" />
    <Surface style={styles.summary}><Label>Selected configuration</Label><Text style={[styles.summaryValue, { color: colors.primary }]}>{configs.find((config) => config.id === selectedConfigId)?.name ?? 'None selected'}</Text><Text style={[styles.summaryHint, { color: colors.mutedForeground }]}>Configurations are preconfigured and read-only.</Text></Surface>
    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Available configs</Text>
    <View style={styles.list}>{configs.map((config) => <Pressable key={config.id} testID={'config-' + config.id} onPress={() => selectConfig(config.id)} style={({ pressed }) => [styles.item, { backgroundColor: config.id === selectedConfigId ? colors.accent : colors.card, borderColor: config.id === selectedConfigId ? colors.primary : colors.border }, pressed && styles.pressed]}><View style={[styles.icon, { backgroundColor: colors.secondary }]}><Text style={[styles.flag, { color: colors.primary }]}>{config.flag}</Text></View><View style={styles.copy}><Text style={[styles.name, { color: colors.foreground }]}>{config.name}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{config.country} • {config.connectionType}</Text></View>{config.id === selectedConfigId ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />}</Pressable>)}</View>
  </Screen>;
}

const styles = StyleSheet.create({
  summary: { marginBottom: 2 },
  summaryValue: { fontFamily: 'Inter_700Bold', fontSize: 22, marginTop: 8 },
  summaryHint: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 6 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, marginTop: 28, marginBottom: 12 },
  list: { gap: 10 },
  item: { minHeight: 76, borderRadius: 18, borderWidth: 1, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  flag: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  copy: { flex: 1 },
  name: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  pressed: { opacity: 0.75 },
});