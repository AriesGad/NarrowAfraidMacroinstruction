import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Header, Pill, Screen, Surface } from '@/components/Primitives';
import { useAppState } from '@/context/AppStateContext';
import { useColors } from '@/hooks/useColors';

export default function LogsScreen() {
  const colors = useColors();
  const { logs, clearLogs, status } = useAppState();
  const statusTone = status === 'connected' ? 'green' : status === 'unavailable' ? 'red' : 'neutral';
  return <Screen><Header eyebrow="Activity" title="VPN Logs" />
    <View style={styles.statusRow}><Pill tone={statusTone}>{status === 'connected' ? 'CONNECTED' : status === 'unavailable' ? 'SERVICE OFFLINE' : status.toUpperCase()}</Pill><Text style={[styles.eventCount, { color: colors.mutedForeground }]}>{logs.length} events</Text><Pressable onPress={clearLogs} hitSlop={8}><Text style={[styles.clearText, { color: colors.primary }]}>CLEAR</Text></Pressable></View>
    <Surface style={styles.logSurface}>{logs.length === 0 ? <View style={styles.empty}><Ionicons name="document-text-outline" size={27} color={colors.mutedForeground} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No VPN events yet</Text><Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>Connection progress, endpoint checks, and errors will appear here.</Text></View> : logs.map((entry) => <View key={entry.id} style={[styles.logRow, { borderBottomColor: colors.border }]}><View style={styles.logMeta}><Text style={[styles.logType, { color: entry.type === 'ERROR' ? colors.primary : colors.foreground }]}>{entry.type}</Text><Text style={[styles.logTime, { color: colors.mutedForeground }]}>{new Date(entry.time).toLocaleTimeString()}</Text></View><Text style={[styles.logMessage, { color: colors.mutedForeground }]}>{entry.message}</Text></View>)}</Surface>
  </Screen>;
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 12 },
  eventCount: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12 },
  clearText: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.7 },
  logSurface: { padding: 14 },
  logRow: { paddingVertical: 12, borderBottomWidth: 1 },
  logMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logType: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.8 },
  logTime: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  logMessage: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginTop: 5 },
  empty: { alignItems: 'center', paddingVertical: 38, paddingHorizontal: 16 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, marginTop: 12 },
  emptyBody: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 7 },
});