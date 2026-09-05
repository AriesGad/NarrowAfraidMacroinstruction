import React, { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModalShell } from '@/components/ModalShell';
import { Header, Label, Pill, PrimaryButton, Screen, Surface } from '@/components/Primitives';
import { RewardManager, useAppState } from '@/context/AppStateContext';
import { useColors } from '@/hooks/useColors';

function formatTime(total: number) {
  const hours = Math.floor(total / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
  const seconds = Math.floor(total % 60).toString().padStart(2, '0');
  return hours + ':' + minutes + ':' + seconds;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { status, accessRemainingSeconds, isAccessExpired, servers, tweaks, selectedServerId, fastestStatus, fastestMessage, selectServer, requestConnection, disconnect, logs, clearLogs } = useAppState();
  const [logOpen, setLogOpen] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [serverPickerOpen, setServerPickerOpen] = useState(false);
  const pulse = useSharedValue(1);
  const selectedServer = useMemo(() => servers.find((server) => server.id === selectedServerId) ?? servers[0], [servers, selectedServerId]);
  const connected = status === 'connected';
  const unavailable = status === 'unavailable';
  const buttonLabel = connected ? 'DISCONNECT' : unavailable ? 'UNAVAILABLE' : 'CONNECT';
  const buttonSubtitle = connected ? 'Connected' : unavailable ? 'Backend not configured' : isAccessExpired ? 'Access expired' : 'Disconnected';
  const builtInTweaks = tweaks.filter((tweak) => !tweak.isCustom).slice(0, 3);

  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.07, { duration: 900 }), withTiming(1, { duration: 900 })), -1, false);
  }, [pulse]);

  const animatedRing = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const onConnectPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    if (connected) disconnect(); else requestConnection();
  };

  return <Screen>
    <View style={{ paddingTop: Math.max(insets.top - 14, 0) }}>
      <Header eyebrow="Aries Tunnel" title="Stay in control" action="VPN LOG" onAction={() => setLogOpen(true)} />
      <View style={styles.heroIntro}><Pill tone={connected ? 'green' : unavailable ? 'red' : 'neutral'}>{buttonSubtitle.toUpperCase()}</Pill><Text style={[styles.introText, { color: colors.mutedForeground }]}>A clear connection state for every session.</Text></View>
      <View style={styles.connectArea}>
        <Animated.View style={[styles.outerRing, { borderColor: connected ? colors.success : colors.primary }, animatedRing]}>
          <Pressable testID="vpn-connect-button" onPress={onConnectPress} style={({ pressed }) => [styles.connectButton, { backgroundColor: connected ? colors.success : colors.primary }, pressed && styles.pressed]}>
            <Ionicons name={connected ? 'shield-checkmark' : unavailable ? 'warning' : 'power'} size={34} color={colors.primaryForeground} />
            <Text style={styles.connectLabel}>{buttonLabel}</Text>
            <Text style={styles.connectStatus}>{buttonSubtitle}</Text>
          </Pressable>
        </Animated.View>
      </View>
      <View style={styles.timerHeader}><Label>VPN access</Label><Text style={[styles.timerValue, { color: isAccessExpired ? colors.mutedForeground : colors.foreground }]}>{isAccessExpired ? '00:00:00' : formatTime(accessRemainingSeconds)}</Text></View>
      <Surface style={styles.accessCard}>
        <View style={styles.accessTop}><View style={[styles.accessIcon, { backgroundColor: colors.accent }]}><Ionicons name="time-outline" size={20} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={[styles.accessTitle, { color: colors.foreground }]}>{isAccessExpired ? 'VPN access expired' : 'Access is active'}</Text><Text style={[styles.accessSubtitle, { color: colors.mutedForeground }]}>{isAccessExpired ? 'Earn time before starting a tunnel.' : 'Your entitlement is calculated from an absolute expiry timestamp.'}</Text></View></View>
        <PrimaryButton title="WATCH AD  +4 HOURS" icon="play-circle" onPress={() => setRewardOpen(true)} />
      </Surface>
      <Surface style={styles.serverCard}>
        <View style={styles.cardHeading}><Label>Current server</Label><Pill tone={selectedServer?.enabled ? 'green' : 'amber'}>{selectedServer?.latency ? selectedServer.latency + ' ms' : 'NOT READY'}</Pill></View>
        <Pressable onPress={() => setServerPickerOpen(true)} style={({ pressed }) => [styles.serverLine, pressed && styles.pressed]}><View style={[styles.serverFlag, { backgroundColor: colors.secondary }]}><Text style={[styles.flagText, { color: colors.primary }]}>{selectedServer?.flag ?? 'AUTO'}</Text></View><View style={{ flex: 1 }}><Text style={[styles.serverName, { color: colors.foreground }]}>{selectedServer?.name ?? 'Random / Fastest'}</Text><Text style={[styles.serverLocation, { color: colors.mutedForeground }]}>{fastestStatus === 'finding' ? 'Finding fastest server...' : fastestMessage || selectedServer?.country}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} /></Pressable>
      </Surface>
      {connected ? <Surface style={styles.statsCard}><View><Label>Connection</Label><Text style={[styles.statValue, { color: colors.success }]}>00:12:48</Text></View><View><Label>Download</Label><Text style={[styles.statValue, { color: colors.foreground }]}>1.8 GB</Text></View><View><Label>Upload</Label><Text style={[styles.statValue, { color: colors.foreground }]}>248 MB</Text></View></Surface> : null}
      {unavailable ? <View style={[styles.notice, { backgroundColor: colors.accent, borderColor: colors.border }]}><Ionicons name="information-circle-outline" size={19} color={colors.primary} /><Text style={[styles.noticeText, { color: colors.accentForeground }]}>Unable to establish VPN connection. No legitimate Android VpnService backend is configured yet.</Text></View> : null}

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Built-in Servers</Text>
      <Surface><View style={styles.sectionHeading}><View><Label>Authorized endpoint catalog</Label><Text style={[styles.sectionDescription, { color: colors.mutedForeground }]}>Locations are ready for operator-approved endpoints.</Text></View><Ionicons name="globe-outline" size={22} color={colors.primary} /></View><Pressable onPress={() => setServerPickerOpen(true)} style={({ pressed }) => [styles.dropdown, { borderColor: colors.border, backgroundColor: colors.secondary }, pressed && styles.pressed]}><Text style={[styles.dropdownText, { color: colors.foreground }]}>{selectedServer?.name ?? 'Random / Fastest'}</Text><Ionicons name="chevron-down" size={18} color={colors.mutedForeground} /></Pressable><Text style={[styles.sourceNote, { color: colors.mutedForeground }]}>No third-party credentials are shipped. Add only endpoints whose operators permit your connection.</Text></Surface>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Built-in Tweaks</Text>
      <Surface>{builtInTweaks.map((tweak) => <View key={tweak.id} style={styles.tweakRow}><View style={[styles.flagBlock, { backgroundColor: colors.secondary }]}><Text style={[styles.flagText, { color: colors.primary }]}>{tweak.flag}</Text></View><View style={{ flex: 1 }}><Text style={[styles.tweakCountry, { color: colors.foreground }]}>{tweak.country}</Text><Text style={[styles.tweakName, { color: colors.mutedForeground }]}>{tweak.name}</Text></View><Pill>{tweak.connectionType}</Pill></View>)}</Surface>
    </View>
    <ModalShell visible={serverPickerOpen} title="Choose a server" subtitle="Random / Fastest measures configured authorized endpoints. It does not choose an arbitrary public server." onClose={() => setServerPickerOpen(false)}><View style={styles.serverList}>{servers.map((server) => <Pressable key={server.id} testID={'home-server-' + server.id} onPress={() => { selectServer(server.id); setServerPickerOpen(false); }} style={({ pressed }) => [styles.serverOption, { backgroundColor: server.id === selectedServerId ? colors.accent : colors.secondary, borderColor: server.id === selectedServerId ? colors.primary : colors.border }, pressed && styles.pressed]}><View style={{ flex: 1 }}><Text style={[styles.serverName, { color: colors.foreground }]}>{server.flag}  {server.name}</Text><Text style={[styles.serverLocation, { color: colors.mutedForeground }]}>{server.enabled ? (server.latency ? server.latency + ' ms' : 'Awaiting endpoint') : 'Not configured'}</Text></View>{server.id === selectedServerId ? <Ionicons name="checkmark-circle" size={19} color={colors.primary} /> : null}</Pressable>)}</View></ModalShell>
    <ModalShell visible={rewardOpen} title="Earn VPN access" subtitle="Watch a rewarded ad to receive 4 hours of VPN access. Time is only granted after the official rewarded-ad SDK confirms that the reward was earned." onClose={() => setRewardOpen(false)}><View style={[styles.modalNote, { backgroundColor: colors.secondary }]}><Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} /><Text style={[styles.modalNoteText, { color: colors.mutedForeground }]}>Google test rewarded-ad ID is configured for the future AdMob integration. No time is granted in this UI-only build.</Text></View><PrimaryButton title="REWARDED AD NOT CONNECTED" icon="lock-closed-outline" disabled onPress={async () => { const earned = await RewardManager.showRewardedAd(); if (earned) setRewardOpen(false); }} /></ModalShell>
    <ModalShell visible={logOpen} title="VPN log" subtitle="Secrets are never written to this log." onClose={() => setLogOpen(false)}><View style={styles.logToolbar}><Text style={[styles.logCount, { color: colors.mutedForeground }]}>{logs.length} events</Text><Pressable onPress={clearLogs}><Text style={[styles.clearText, { color: colors.primary }]}>CLEAR LOG</Text></Pressable></View><View style={[styles.logList, { borderColor: colors.border }]}>{logs.length === 0 ? <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No VPN events yet.</Text> : logs.slice(0, 6).map((entry) => <View key={entry.id} style={styles.logRow}><Text style={[styles.logType, { color: entry.type === 'ERROR' ? colors.primary : colors.foreground }]}>{entry.type}</Text><Text style={[styles.logMessage, { color: colors.mutedForeground }]}>{entry.message}</Text></View>)}</View></ModalShell>
  </Screen>;
}

const styles = StyleSheet.create({
  heroIntro: { flexDirection: 'row', alignItems: 'center', gap: 10 }, introText: { fontFamily: 'Inter_400Regular', fontSize: 12 }, connectArea: { alignItems: 'center', justifyContent: 'center', paddingVertical: 30 }, outerRing: { width: 218, height: 218, borderRadius: 140, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, connectButton: { width: 186, height: 186, borderRadius: 100, alignItems: 'center', justifyContent: 'center', gap: 7 }, connectLabel: { color: '#ffffff', fontFamily: 'Inter_700Bold', letterSpacing: 1.4, fontSize: 19 }, connectStatus: { color: 'rgba(255,255,255,0.78)', fontFamily: 'Inter_500Medium', fontSize: 11 }, timerHeader: { alignItems: 'center', marginBottom: 16 }, timerValue: { fontFamily: 'Inter_700Bold', fontSize: 35, letterSpacing: 1.5, marginTop: 6 }, accessCard: { gap: 18 }, accessTop: { flexDirection: 'row', alignItems: 'center', gap: 12 }, accessIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, accessTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 }, accessSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 4 }, serverCard: { marginTop: 14 }, cardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }, serverLine: { flexDirection: 'row', alignItems: 'center', gap: 12 }, serverFlag: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, flagText: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.5 }, serverName: { fontFamily: 'Inter_700Bold', fontSize: 14 }, serverLocation: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 }, statsCard: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between' }, statValue: { fontFamily: 'Inter_700Bold', fontSize: 16, marginTop: 7 }, notice: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 17, borderWidth: 1, marginTop: 14 }, noticeText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18 }, sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 19, marginTop: 28, marginBottom: 12 }, sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }, sectionDescription: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 7, maxWidth: 270 }, dropdown: { minHeight: 52, marginTop: 17, paddingHorizontal: 14, borderRadius: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, dropdownText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 }, sourceNote: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, marginTop: 12 }, tweakRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }, flagBlock: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, tweakCountry: { fontFamily: 'Inter_600SemiBold', fontSize: 13 }, tweakName: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 3 }, serverList: { gap: 9, marginTop: 16 }, serverOption: { minHeight: 62, borderRadius: 15, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }, modalNote: { flexDirection: 'row', gap: 10, borderRadius: 16, padding: 14, marginVertical: 18 }, modalNoteText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 }, logToolbar: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 16 }, logCount: { fontFamily: 'Inter_500Medium', fontSize: 12 }, clearText: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.7 }, logList: { borderWidth: 1, borderRadius: 16, padding: 12, maxHeight: 280 }, logRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }, logType: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.8 }, logMessage: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4, lineHeight: 17 }, emptyText: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', padding: 16 }, pressed: { opacity: 0.75 },
});
