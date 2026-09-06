import React, { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ModalShell } from '@/components/ModalShell';
import { Pill, Screen } from '@/components/Primitives';
import { useAppState } from '@/context/AppStateContext';
import { useColors } from '@/hooks/useColors';

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status, servers, configs, selectedServerId, selectedConfigId, selectServer, selectConfig, requestConnection, disconnect } = useAppState();
  const [menuOpen, setMenuOpen] = useState(false);
  const [serverPickerOpen, setServerPickerOpen] = useState(false);
  const [configPickerOpen, setConfigPickerOpen] = useState(false);
  const pulse = useSharedValue(1);
  const selectedServer = useMemo(() => servers.find((server) => server.id === selectedServerId), [servers, selectedServerId]);
  const selectedConfig = useMemo(() => configs.find((config) => config.id === selectedConfigId), [configs, selectedConfigId]);
  const connected = status === 'connected';
  const connecting = status === 'connecting';
  const failed = status === 'failed';

  React.useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.04, { duration: 900 }), withTiming(1, { duration: 900 })), -1, false);
  }, [pulse]);

  const animatedRing = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const onConnectPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    if (connected) {
      disconnect();
      return;
    }
    if (!selectedServer || !selectedConfig) {
      Alert.alert('Select server and configuration', 'Please select a server and configuration before connecting.');
      return;
    }
    requestConnection();
  };

  return <Screen>
    <View style={[styles.dashboard, { paddingTop: Math.max(insets.top - 9, 0) }]}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Open VPN menu" onPress={() => setMenuOpen(true)} hitSlop={12} style={({ pressed }) => [styles.topIcon, pressed && styles.pressed]}><Ionicons name="menu-outline" size={23} color={colors.foreground} /></Pressable>
        <Text style={[styles.brand, { color: colors.foreground }]}>ARIES TUNNEL</Text>
        <View style={styles.topIcon} />
      </View>
      <View style={styles.trafficBar}><TrafficStat icon="cloud-download-outline" value="0 B" label="DOWNLOAD" colors={colors} /><View style={[styles.liveDot, { backgroundColor: connected ? colors.success : colors.primary }]} /><TrafficStat icon="cloud-upload-outline" value="0 B" label="UPLOAD" colors={colors} align="right" /></View>

      <View style={styles.hero}>
        <View pointerEvents="none" style={styles.waveBackdrop}><View style={[styles.wave, styles.waveLeft, { borderColor: colors.primary }]} /><View style={[styles.wave, styles.waveRight, { borderColor: colors.primary }]} /><View style={[styles.wave, styles.waveFine, { borderColor: colors.primary }]} /></View>
        <Animated.View style={[styles.outerRing, { borderColor: connected ? colors.success : colors.primary }, animatedRing]}>
          <Pressable testID="vpn-connect-button" onPress={onConnectPress} style={({ pressed }) => [styles.connectButton, { backgroundColor: colors.card, borderColor: connected ? colors.success : colors.primary }, pressed && styles.pressed]}>
            <Ionicons name={connected ? 'stop' : failed ? 'warning-outline' : 'power-outline'} size={28} color={connected ? colors.success : colors.primary} />
            <Text style={[styles.connectLabel, { color: colors.foreground }]}>{connected ? 'END' : 'START'}</Text>
            <Text style={[styles.connectStatus, { color: colors.mutedForeground }]}>{connected ? 'CONNECTED' : connecting ? 'CONNECTING...' : failed ? 'CONNECTION FAILED' : 'DISCONNECTED'}</Text>
          </Pressable>
        </Animated.View>
        <Text style={[styles.heroHint, { color: colors.mutedForeground }]}>{connected ? 'Protected connection established' : 'Select a server and config to begin'}</Text>
      </View>

      <Pressable onPress={() => setServerPickerOpen(true)} style={({ pressed }) => [styles.optionBar, { backgroundColor: colors.primary }, pressed && styles.pressed]}><View style={styles.optionIcon}><Ionicons name="server-outline" size={21} color={colors.primaryForeground} /></View><View style={styles.optionCopy}><Text style={styles.optionText}>{selectedServer ? selectedServer.flag + '  ' + selectedServer.name : 'Servers'}</Text><Text style={styles.optionMeta}>{selectedServer?.country ?? 'Select a server'}</Text></View><Ionicons name="chevron-forward" size={19} color={colors.primaryForeground} /></Pressable>
      <Pressable onPress={() => setConfigPickerOpen(true)} style={({ pressed }) => [styles.optionBar, { backgroundColor: colors.primary }, pressed && styles.pressed]}><View style={styles.optionIcon}><Ionicons name="layers-outline" size={21} color={colors.primaryForeground} /></View><View style={styles.optionCopy}><Text style={styles.optionText}>{selectedConfig ? selectedConfig.flag + '  ' + selectedConfig.name : 'Configs'}</Text><Text style={styles.optionMeta}>{selectedConfig?.country ?? 'Select a configuration'}</Text></View><Ionicons name="chevron-forward" size={19} color={colors.primaryForeground} /></Pressable>
      {failed ? <View style={[styles.statusNote, { borderColor: colors.border, backgroundColor: colors.accent }]}><Pill tone="red">CONNECTION FAILED</Pill><Text style={[styles.statusNoteText, { color: colors.accentForeground }]}>The VPN backend did not confirm a tunnel connection.</Text></View> : null}
    </View>

    <ModalShell visible={serverPickerOpen} title="Choose a server" subtitle="Select from the preconfigured servers available to this app." onClose={() => setServerPickerOpen(false)}><View style={styles.serverList}>{servers.map((server) => <Pressable key={server.id} testID={'home-server-' + server.id} onPress={() => { selectServer(server.id); setServerPickerOpen(false); }} style={({ pressed }) => [styles.serverOption, { backgroundColor: server.id === selectedServerId ? colors.accent : colors.secondary, borderColor: server.id === selectedServerId ? colors.primary : colors.border }, pressed && styles.pressed]}><View style={{ flex: 1 }}><Text style={[styles.serverName, { color: colors.foreground }]}>{server.flag}  {server.name}</Text><Text style={[styles.serverLocation, { color: colors.mutedForeground }]}>{server.country}</Text></View>{server.id === selectedServerId ? <Ionicons name="checkmark-circle" size={19} color={colors.primary} /> : null}</Pressable>)}</View></ModalShell>
    <ModalShell visible={configPickerOpen} title="Choose a configuration" subtitle="Select from the preconfigured configurations available to this app." onClose={() => setConfigPickerOpen(false)}><View style={styles.serverList}>{configs.map((config) => <Pressable key={config.id} testID={'home-config-' + config.id} onPress={() => { selectConfig(config.id); setConfigPickerOpen(false); }} style={({ pressed }) => [styles.serverOption, { backgroundColor: config.id === selectedConfigId ? colors.accent : colors.secondary, borderColor: config.id === selectedConfigId ? colors.primary : colors.border }, pressed && styles.pressed]}><View style={{ flex: 1 }}><Text style={[styles.serverName, { color: colors.foreground }]}>{config.flag}  {config.name}</Text><Text style={[styles.serverLocation, { color: colors.mutedForeground }]}>{config.country} • {config.connectionType}</Text></View>{config.id === selectedConfigId ? <Ionicons name="checkmark-circle" size={19} color={colors.primary} /> : null}</Pressable>)}</View></ModalShell>

    <Modal visible={menuOpen} transparent animationType="none" onRequestClose={() => setMenuOpen(false)}><View style={styles.drawerRoot}><Pressable style={styles.drawerBackdrop} onPress={() => setMenuOpen(false)} /><View style={[styles.drawer, { backgroundColor: colors.card, paddingTop: insets.top + 14 }]}><View style={styles.drawerHeader}><View style={[styles.drawerMark, { backgroundColor: colors.primary }]}><Ionicons name="shield-checkmark" size={22} color={colors.primaryForeground} /></View><View style={{ flex: 1 }}><Text style={[styles.drawerBrand, { color: colors.foreground }]}>ARIES TUNNEL</Text><Text style={[styles.drawerSubtitle, { color: colors.mutedForeground }]}>VPN CONTROL CENTER</Text></View><Pressable onPress={() => setMenuOpen(false)} hitSlop={10}><Ionicons name="close" size={21} color={colors.mutedForeground} /></Pressable></View><Pressable onPress={() => { setMenuOpen(false); router.push('/(tabs)/logs'); }} style={({ pressed }) => [styles.drawerRow, pressed && styles.pressed]}><View style={[styles.drawerIcon, { backgroundColor: colors.secondary }]}><Ionicons name="list-outline" size={17} color={colors.primary} /></View><Text style={[styles.drawerLabel, { color: colors.foreground }]}>VPN Logs</Text><Ionicons name="chevron-forward" size={17} color={colors.mutedForeground} /></Pressable><Text style={[styles.drawerFooter, { color: colors.mutedForeground }]}>Server and configuration definitions are read-only.</Text></View></View></Modal>
  </Screen>;
}

function TrafficStat({ icon, value, label, colors, align = 'left' }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string; colors: ReturnType<typeof useColors>; align?: 'left' | 'right' }) {
  return <View style={[styles.trafficStat, align === 'right' && styles.trafficRight]}><Ionicons name={icon} size={16} color={colors.mutedForeground} /><View><Text style={[styles.trafficValue, { color: colors.foreground }]}>{value}</Text><Text style={[styles.trafficLabel, { color: colors.mutedForeground }]}>{label}</Text></View></View>;
}

const styles = StyleSheet.create({
  dashboard: { position: 'relative' },
  topBar: { minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topIcon: { width: 30, height: 34, alignItems: 'center', justifyContent: 'center' },
  brand: { fontFamily: 'Inter_700Bold', fontSize: 15, letterSpacing: 1.2 },
  pressed: { opacity: 0.7 },
  trafficBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, marginTop: 8 },
  trafficStat: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 84 },
  trafficRight: { justifyContent: 'flex-end' },
  trafficValue: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  trafficLabel: { fontFamily: 'Inter_500Medium', fontSize: 8, letterSpacing: 0.7, marginTop: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 6, opacity: 0.9 },
  hero: { minHeight: 310, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginHorizontal: -20 },
  waveBackdrop: { ...StyleSheet.absoluteFill, opacity: 0.45 },
  wave: { position: 'absolute', borderWidth: 2, borderRadius: 200 },
  waveLeft: { width: 370, height: 215, left: -215, top: 50, transform: [{ rotate: '29deg' }] },
  waveRight: { width: 350, height: 190, right: -205, top: 68, transform: [{ rotate: '-26deg' }] },
  waveFine: { width: 420, height: 180, left: -5, top: 92, borderWidth: 1, transform: [{ rotate: '7deg' }] },
  outerRing: { width: 164, height: 164, borderRadius: 100, borderWidth: 2, alignItems: 'center', justifyContent: 'center', shadowColor: '#ef3d3d', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } },
  connectButton: { width: 134, height: 134, borderRadius: 100, borderWidth: 2, alignItems: 'center', justifyContent: 'center', gap: 5 },
  connectLabel: { fontFamily: 'Inter_500Medium', fontSize: 21, letterSpacing: 0.5 },
  connectStatus: { fontFamily: 'Inter_500Medium', fontSize: 8, letterSpacing: 0.8 },
  heroHint: { position: 'absolute', bottom: 11, fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 0.5 },
  optionBar: { minHeight: 54, borderRadius: 28, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  optionIcon: { width: 30, alignItems: 'center' },
  optionCopy: { flex: 1 },
  optionText: { color: '#ffffff', fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.2 },
  optionMeta: { color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter_500Medium', fontSize: 9, marginTop: 3, letterSpacing: 0.5 },
  statusNote: { marginTop: 14, padding: 12, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  statusNoteText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  serverList: { gap: 9, marginTop: 16 },
  serverOption: { minHeight: 62, borderRadius: 15, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' },
  serverName: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  serverLocation: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  drawerRoot: { flex: 1, flexDirection: 'row' },
  drawerBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.66)' },
  drawer: { width: '78%', height: '100%', paddingHorizontal: 20, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 8, height: 0 }, elevation: 12 },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 18, marginBottom: 7 },
  drawerMark: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  drawerBrand: { fontFamily: 'Inter_700Bold', fontSize: 15, letterSpacing: 1 },
  drawerSubtitle: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 0.8, marginTop: 4 },
  drawerRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12 },
  drawerIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  drawerLabel: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13 },
  drawerFooter: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 16, marginTop: 18, paddingBottom: 24 },
});