import React, { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModalShell } from '@/components/ModalShell';
import { Label, Pill, PrimaryButton, Screen, Surface } from '@/components/Primitives';
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
  const { status, accessRemainingSeconds, isAccessExpired, servers, tweaks, selectedServerId, selectedProfileId, fastestStatus, fastestMessage, selectServer, selectProfile, requestConnection, disconnect, logs, clearLogs } = useAppState();
  const [logOpen, setLogOpen] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [serverPickerOpen, setServerPickerOpen] = useState(false);
  const pulse = useSharedValue(1);
  const selectedServer = useMemo(() => servers.find((server) => server.id === selectedServerId) ?? servers[0], [servers, selectedServerId]);
  const selectedTweak = useMemo(() => tweaks.find((tweak) => tweak.id === selectedProfileId) ?? tweaks[0], [tweaks, selectedProfileId]);
  const connected = status === 'connected';
  const unavailable = status === 'unavailable';
  const buttonLabel = connected ? 'END' : 'START';
  const buttonSubtitle = connected ? 'CONNECTED' : unavailable ? 'SERVICE OFFLINE' : isAccessExpired ? 'ACCESS EXPIRED' : 'READY TO CONNECT';

  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.04, { duration: 900 }), withTiming(1, { duration: 900 })), -1, false);
  }, [pulse]);

  const animatedRing = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const onConnectPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    if (connected) disconnect(); else requestConnection();
  };

  return <Screen>
    <View style={[styles.dashboard, { paddingTop: Math.max(insets.top - 9, 0) }]}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Open VPN log" onPress={() => setLogOpen(true)} hitSlop={12} style={({ pressed }) => [styles.topIcon, pressed && styles.pressed]}><Ionicons name="menu-outline" size={23} color={colors.foreground} /></Pressable>
        <Text style={[styles.brand, { color: colors.foreground }]}>ARIES TUNNEL</Text>
        <Pressable accessibilityLabel="Open VPN log" onPress={() => setLogOpen(true)} hitSlop={12} style={({ pressed }) => [styles.topIcon, pressed && styles.pressed]}><Ionicons name="ellipsis-vertical" size={20} color={colors.foreground} /></Pressable>
      </View>
      <View style={styles.trafficBar}><TrafficStat icon="cloud-download-outline" value="0 B" label="DOWNLOAD" colors={colors} /><View style={[styles.liveDot, { backgroundColor: connected ? colors.success : colors.primary }]} /><TrafficStat icon="cloud-upload-outline" value="0 B" label="UPLOAD" colors={colors} align="right" /></View>

      <View style={styles.hero}>
        <View pointerEvents="none" style={styles.waveBackdrop}>
          <View style={[styles.wave, styles.waveLeft, { borderColor: colors.primary }]} />
          <View style={[styles.wave, styles.waveRight, { borderColor: colors.primary }]} />
          <View style={[styles.wave, styles.waveFine, { borderColor: colors.primary }]} />
        </View>
        <Animated.View style={[styles.outerRing, { borderColor: connected ? colors.success : colors.primary }, animatedRing]}>
          <Pressable testID="vpn-connect-button" onPress={onConnectPress} style={({ pressed }) => [styles.connectButton, { backgroundColor: colors.card, borderColor: connected ? colors.success : colors.primary }, pressed && styles.pressed]}>
            <Ionicons name={connected ? 'stop' : unavailable ? 'warning-outline' : 'power-outline'} size={28} color={connected ? colors.success : colors.primary} />
            <Text style={[styles.connectLabel, { color: colors.foreground }]}>{buttonLabel}</Text>
            <Text style={[styles.connectStatus, { color: colors.mutedForeground }]}>{buttonSubtitle}</Text>
          </Pressable>
        </Animated.View>
        <Text style={[styles.heroHint, { color: colors.mutedForeground }]}>{connected ? 'Tunnel is active' : isAccessExpired ? 'Watch an ad to add access time' : 'Tap to start your protected session'}</Text>
      </View>

      <Pressable onPress={() => setRewardOpen(true)} style={({ pressed }) => [styles.adSlot, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}><View style={[styles.adBadge, { backgroundColor: colors.primary }]}><Ionicons name="play" size={11} color={colors.primaryForeground} /></View><View style={styles.adCopy}><Text style={[styles.adTitle, { color: colors.foreground }]}>REWARDED ACCESS</Text><Text style={[styles.adSubtitle, { color: colors.mutedForeground }]}>Watch a test ad to add +4 hours</Text></View><Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} /></Pressable>

      <Pressable onPress={() => setServerPickerOpen(true)} style={({ pressed }) => [styles.optionBar, { backgroundColor: colors.primary }, pressed && styles.pressed]}><View style={styles.optionIcon}><Ionicons name="link-outline" size={21} color={colors.primaryForeground} /></View><View style={styles.optionCopy}><Text style={styles.optionText}>{selectedServer?.flag ?? 'AUTO'}  {selectedServer?.name ?? 'RANDOM / FASTEST'}</Text><Text style={styles.optionMeta}>{fastestStatus === 'finding' ? 'FINDING FASTEST SERVER…' : fastestMessage || selectedServer?.country || 'SELECT SERVER'}</Text></View><Ionicons name="chevron-forward" size={19} color={colors.primaryForeground} /></Pressable>
      <Pressable onPress={() => selectProfile(selectedTweak?.id ?? 'tweak-sg-stable')} style={({ pressed }) => [styles.optionBar, { backgroundColor: colors.primary }, pressed && styles.pressed]}><View style={styles.optionIcon}><Ionicons name="radio-outline" size={21} color={colors.primaryForeground} /></View><View style={styles.optionCopy}><Text style={styles.optionText}>{selectedTweak?.flag ?? 'SG'}  {selectedTweak?.name ?? 'SINGAPORE STABLE'}</Text><Text style={styles.optionMeta}>{selectedTweak?.connectionType ?? 'SELECT TWEAK'}</Text></View><Ionicons name="chevron-forward" size={19} color={colors.primaryForeground} /></Pressable>
      <View style={[styles.timeBar, { backgroundColor: colors.primary }]}><View style={styles.timeCopy}><Ionicons name="time-outline" size={22} color={colors.primaryForeground} /><Text style={styles.timeText}>{isAccessExpired ? '00:00:00' : formatTime(accessRemainingSeconds)}</Text></View><Pressable onPress={() => setRewardOpen(true)} style={({ pressed }) => [styles.addTime, { backgroundColor: colors.background }, pressed && styles.pressed]}><Text style={[styles.addTimeText, { color: colors.foreground }]}>ADD TIME</Text><Ionicons name="add" size={16} color={colors.primary} /></Pressable></View>

      {unavailable ? <View style={[styles.statusNote, { borderColor: colors.border, backgroundColor: colors.accent }]}><Pill tone="red">NOT CONNECTED</Pill><Text style={[styles.statusNoteText, { color: colors.accentForeground }]}>No Android VpnService backend is configured yet.</Text></View> : null}
    </View>

    <ModalShell visible={serverPickerOpen} title="Choose a server" subtitle="Random / Fastest measures configured authorized endpoints. It does not choose an arbitrary public server." onClose={() => setServerPickerOpen(false)}><View style={styles.serverList}>{servers.map((server) => <Pressable key={server.id} testID={'home-server-' + server.id} onPress={() => { selectServer(server.id); setServerPickerOpen(false); }} style={({ pressed }) => [styles.serverOption, { backgroundColor: server.id === selectedServerId ? colors.accent : colors.secondary, borderColor: server.id === selectedServerId ? colors.primary : colors.border }, pressed && styles.pressed]}><View style={{ flex: 1 }}><Text style={[styles.serverName, { color: colors.foreground }]}>{server.flag}  {server.name}</Text><Text style={[styles.serverLocation, { color: colors.mutedForeground }]}>{server.enabled ? (server.latency ? server.latency + ' ms' : 'Awaiting endpoint') : 'Not configured'}</Text></View>{server.id === selectedServerId ? <Ionicons name="checkmark-circle" size={19} color={colors.primary} /> : null}</Pressable>)}</View></ModalShell>
    <ModalShell visible={rewardOpen} title="Earn VPN access" subtitle="Watch a rewarded ad to receive 4 hours of VPN access. Time is only granted after the official rewarded-ad SDK confirms that the reward was earned." onClose={() => setRewardOpen(false)}><View style={[styles.modalNote, { backgroundColor: colors.secondary }]}><Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} /><Text style={[styles.modalNoteText, { color: colors.mutedForeground }]}>Google test rewarded-ad ID is configured for the future AdMob integration. No time is granted in this UI-only build.</Text></View><PrimaryButton title="REWARDED AD NOT CONNECTED" icon="lock-closed-outline" disabled onPress={async () => { const earned = await RewardManager.showRewardedAd(); if (earned) setRewardOpen(false); }} /></ModalShell>
    <ModalShell visible={logOpen} title="VPN log" subtitle="Secrets are never written to this log." onClose={() => setLogOpen(false)}><View style={styles.logToolbar}><Text style={[styles.logCount, { color: colors.mutedForeground }]}>{logs.length} events</Text><Pressable onPress={clearLogs}><Text style={[styles.clearText, { color: colors.primary }]}>CLEAR LOG</Text></Pressable></View><View style={[styles.logList, { borderColor: colors.border }]}>{logs.length === 0 ? <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No VPN events yet.</Text> : logs.slice(0, 6).map((entry) => <View key={entry.id} style={styles.logRow}><Text style={[styles.logType, { color: entry.type === 'ERROR' ? colors.primary : colors.foreground }]}>{entry.type}</Text><Text style={[styles.logMessage, { color: colors.mutedForeground }]}>{entry.message}</Text></View>)}</View></ModalShell>
  </Screen>;
}

function TrafficStat({ icon, value, label, colors, align = 'left' }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string; colors: ReturnType<typeof useColors>; align?: 'left' | 'right' }) {
  return <View style={[styles.trafficStat, align === 'right' && styles.trafficRight]}><Ionicons name={icon} size={16} color={colors.mutedForeground} /><View><Text style={[styles.trafficValue, { color: colors.foreground }]}>{value}</Text><Text style={[styles.trafficLabel, { color: colors.mutedForeground }]}>{label}</Text></View></View>;
}

const styles = StyleSheet.create({
  dashboard: { position: 'relative' }, topBar: { minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, topIcon: { width: 30, height: 34, alignItems: 'center', justifyContent: 'center' }, brand: { fontFamily: 'Inter_700Bold', fontSize: 15, letterSpacing: 1.2 }, pressed: { opacity: 0.7 }, trafficBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, marginTop: 8 }, trafficStat: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 84 }, trafficRight: { justifyContent: 'flex-end' }, trafficValue: { fontFamily: 'Inter_600SemiBold', fontSize: 10 }, trafficLabel: { fontFamily: 'Inter_500Medium', fontSize: 8, letterSpacing: 0.7, marginTop: 2 }, liveDot: { width: 6, height: 6, borderRadius: 6, opacity: 0.9 }, hero: { minHeight: 310, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginHorizontal: -20 }, waveBackdrop: { ...StyleSheet.absoluteFill, opacity: 0.45 }, wave: { position: 'absolute', borderWidth: 2, borderRadius: 200 }, waveLeft: { width: 370, height: 215, left: -215, top: 50, transform: [{ rotate: '29deg' }] }, waveRight: { width: 350, height: 190, right: -205, top: 68, transform: [{ rotate: '-26deg' }] }, waveFine: { width: 420, height: 180, left: -5, top: 92, borderWidth: 1, transform: [{ rotate: '7deg' }] }, outerRing: { width: 164, height: 164, borderRadius: 100, borderWidth: 2, alignItems: 'center', justifyContent: 'center', shadowColor: '#ef3d3d', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } }, connectButton: { width: 134, height: 134, borderRadius: 100, borderWidth: 2, alignItems: 'center', justifyContent: 'center', gap: 5 }, connectLabel: { fontFamily: 'Inter_500Medium', fontSize: 21, letterSpacing: 0.5 }, connectStatus: { fontFamily: 'Inter_500Medium', fontSize: 8, letterSpacing: 0.8 }, heroHint: { position: 'absolute', bottom: 11, fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 0.5 }, adSlot: { minHeight: 57, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }, adBadge: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, adCopy: { flex: 1 }, adTitle: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.7 }, adSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 }, optionBar: { minHeight: 54, borderRadius: 28, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }, optionIcon: { width: 30, alignItems: 'center' }, optionCopy: { flex: 1 }, optionText: { color: '#ffffff', fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.2 }, optionMeta: { color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter_500Medium', fontSize: 9, marginTop: 3, letterSpacing: 0.5 }, timeBar: { minHeight: 55, borderRadius: 28, paddingLeft: 16, paddingRight: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, timeCopy: { flexDirection: 'row', alignItems: 'center', gap: 9 }, timeText: { color: '#ffffff', fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 0.5 }, addTime: { minHeight: 41, minWidth: 112, borderRadius: 22, paddingHorizontal: 14, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center' }, addTimeText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.5 }, statusNote: { marginTop: 14, padding: 12, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 9 }, statusNoteText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 }, serverList: { gap: 9, marginTop: 16 }, serverOption: { minHeight: 62, borderRadius: 15, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }, serverName: { fontFamily: 'Inter_700Bold', fontSize: 14 }, serverLocation: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 }, modalNote: { flexDirection: 'row', gap: 10, borderRadius: 16, padding: 14, marginVertical: 18 }, modalNoteText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 }, logToolbar: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 16 }, logCount: { fontFamily: 'Inter_500Medium', fontSize: 12 }, clearText: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.7 }, logList: { borderWidth: 1, borderRadius: 16, padding: 12, maxHeight: 280 }, logRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }, logType: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.8 }, logMessage: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4, lineHeight: 17 }, emptyText: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', padding: 16 },
});
