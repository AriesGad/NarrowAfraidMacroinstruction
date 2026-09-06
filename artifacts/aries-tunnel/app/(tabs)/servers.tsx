import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Header, Label, Pill, Screen, Surface } from '@/components/Primitives';
import { useAppState } from '@/context/AppStateContext';
import { useColors } from '@/hooks/useColors';

export default function ServersScreen() {
  const colors = useColors();
  const { servers, selectedServerId, selectServer } = useAppState();
  return <Screen>
    <Header eyebrow="Selection" title="Servers" />
    <Surface style={styles.summary}><Label>Selected server</Label><Text style={[styles.summaryValue, { color: colors.primary }]}>{servers.find((server) => server.id === selectedServerId)?.name ?? 'None selected'}</Text><Text style={[styles.summaryHint, { color: colors.mutedForeground }]}>Servers are preconfigured and read-only.</Text></Surface>
    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Available servers</Text>
    <View style={styles.list}>{servers.map((server) => <Pressable key={server.id} testID={'server-' + server.id} onPress={() => selectServer(server.id)} style={({ pressed }) => [styles.item, { backgroundColor: server.id === selectedServerId ? colors.accent : colors.card, borderColor: server.id === selectedServerId ? colors.primary : colors.border }, pressed && styles.pressed]}><View style={[styles.icon, { backgroundColor: colors.secondary }]}><Text style={[styles.flag, { color: colors.primary }]}>{server.flag}</Text></View><View style={styles.copy}><Text style={[styles.name, { color: colors.foreground }]}>{server.name}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{server.country}</Text></View>{server.id === selectedServerId ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />}</Pressable>)}</View>
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