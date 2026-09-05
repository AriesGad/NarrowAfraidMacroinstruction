import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Header, Label, Pill, PrimaryButton, Row, Screen, Surface } from '@/components/Primitives';
import { ModalShell } from '@/components/ModalShell';
import { useAppState } from '@/context/AppStateContext';
import { useColors } from '@/hooks/useColors';

export default function ServersScreen() {
  const colors = useColors();
  const { servers, selectedServerId, selectServer } = useAppState();
  const [refreshing, setRefreshing] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const refresh = () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 650); };

  return <Screen><Header eyebrow="Network" title="Servers" action={refreshing ? 'SYNCING' : 'REFRESH'} onAction={refresh} />
    <Surface style={styles.summary}><View><Label>Available locations</Label><Text style={[styles.bigNumber, { color: colors.foreground }]}>{servers.length.toString().padStart(2, '0')}</Text></View><View style={styles.summaryDivider} /><View><Label>Selected</Label><Text style={[styles.selectedText, { color: colors.primary }]}>{servers.find((server) => server.id === selectedServerId)?.name ?? 'None'}</Text></View></Surface>
    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Server list</Text>
    <View style={styles.list}>{servers.map((server) => <Pressable key={server.id} testID={'server-' + server.id} onPress={() => selectServer(server.id)} style={({ pressed }) => [styles.serverItem, { backgroundColor: server.id === selectedServerId ? colors.accent : colors.card, borderColor: server.id === selectedServerId ? colors.primary : colors.border }, pressed && styles.pressed]}><View style={[styles.serverIcon, { backgroundColor: colors.secondary }]}><Ionicons name={server.isCustom ? 'construct-outline' : 'globe-outline'} size={19} color={server.id === selectedServerId ? colors.primary : colors.mutedForeground} /></View><View style={{ flex: 1 }}><Text style={[styles.serverName, { color: colors.foreground }]}>{server.name}</Text><Text style={[styles.serverLocation, { color: colors.mutedForeground }]}>{server.location}</Text></View><View style={styles.serverMeta}>{server.available ? <Pill tone={server.id === selectedServerId ? 'green' : 'neutral'}>{server.ping + ' ms'}</Pill> : <Pill tone="amber">LOCAL</Pill>}{server.id === selectedServerId ? <Ionicons name="checkmark-circle" size={19} color={colors.primary} /> : null}</View></Pressable>)}</View>
    <Surface style={styles.customCard}><Row icon="add-circle-outline" title="Custom server" subtitle="Save a non-sensitive server label for later setup" right={<Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />} onPress={() => setCustomOpen(true)} /><Text style={[styles.helper, { color: colors.mutedForeground }]}>Credentials and private keys are intentionally not collected or stored in this prototype.</Text></Surface>
    <ModalShell visible={customOpen} title="Add custom server" subtitle="Create a local server profile. A real protocol configuration will be connected in the next backend stage." onClose={() => setCustomOpen(false)}><TextInput value={name} onChangeText={setName} placeholder="Server name" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary }]} /><TextInput value={location} onChangeText={setLocation} placeholder="Country or location" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary }]} /><PrimaryButton title="SAVE SERVER PROFILE" icon="checkmark" disabled={!name.trim() || !location.trim()} onPress={() => { setCustomOpen(false); setName(''); setLocation(''); }} /></ModalShell>
  </Screen>;
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  bigNumber: { fontFamily: 'Inter_700Bold', fontSize: 30, marginTop: 8 },
  summaryDivider: { width: 1, height: 48, backgroundColor: '#29292e' },
  selectedText: { fontFamily: 'Inter_700Bold', fontSize: 14, marginTop: 8, maxWidth: 140 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, marginTop: 28, marginBottom: 12 },
  list: { gap: 10 },
  serverItem: { minHeight: 78, borderRadius: 19, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  serverIcon: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  serverName: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  serverLocation: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  serverMeta: { alignItems: 'flex-end', gap: 8 },
  customCard: { marginTop: 14 },
  helper: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, marginTop: 8, paddingLeft: 50 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, fontFamily: 'Inter_400Regular', fontSize: 14, marginTop: 14 },
  pressed: { opacity: 0.75 },
});
