import React, { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Alert, BackHandler, Image, Modal, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ModalShell } from '@/components/ModalShell';
import { Pill, PrimaryButton, Screen } from '@/components/Primitives';
import { useAppState } from '@/context/AppStateContext';
import { useColors } from '@/hooks/useColors';

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status, accessRemainingSeconds, isAccessExpired, servers, configs, selectedServerId, selectedConfigId, settings, configVersion, fastestStatus, fastestMessage, selectServer, findFastestServer, selectConfig, toggleSetting, updateSetting, clearAppData, requestConnection, disconnect, updateConfig, grantAccess } = useAppState();
  const [menuOpen, setMenuOpen] = useState(false);
  const [serverPickerOpen, setServerPickerOpen] = useState(false);
  const [configPickerOpen, setConfigPickerOpen] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [forwardEditor, setForwardEditor] = useState<'dns' | 'udp' | null>(null);
  const [serverQuery, setServerQuery] = useState('');
  const [configQuery, setConfigQuery] = useState('');
  const pulse = useSharedValue(1);
  const selectedServer = useMemo(() => servers.find((server) => server.id === selectedServerId), [servers, selectedServerId]);
  const selectedConfig = useMemo(() => configs.find((config) => config.id === selectedConfigId), [configs, selectedConfigId]);
  const visibleServers = useMemo(() => servers.filter((server) => (server.name + ' ' + server.country + ' ' + server.protocol).toLowerCase().includes(serverQuery.trim().toLowerCase())), [servers, serverQuery]);
  const visibleConfigs = useMemo(() => configs.filter((config) => (config.name + ' ' + config.country + ' ' + config.connectionType).toLowerCase().includes(configQuery.trim().toLowerCase())), [configs, configQuery]);
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
  const exitApp = () => {
    if (Platform.OS === 'android') BackHandler.exitApp();
    else Alert.alert('Exit Aries Tunnel', 'Use your device controls to close the app.');
  };
  const runConfigUpdate = async () => {
    setActionMenuOpen(false);
    const result = await updateConfig();
    Alert.alert(result.success ? 'Config update' : 'Config update unavailable', result.message);
  };

  return <Screen>
    <View style={[styles.dashboard, { paddingTop: Math.max(insets.top - 9, 0) }]}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Open VPN menu" onPress={() => setMenuOpen(true)} hitSlop={12} style={({ pressed }) => [styles.topIcon, pressed && styles.pressed]}><Ionicons name="menu-outline" size={23} color={colors.foreground} /></Pressable>
        <Text style={[styles.brand, { color: colors.foreground }]}>ARIES TUNNEL</Text>
        <Pressable accessibilityLabel="Open app actions" onPress={() => setActionMenuOpen(true)} hitSlop={12} style={({ pressed }) => [styles.topIcon, pressed && styles.pressed]}><Ionicons name="ellipsis-vertical" size={20} color={colors.foreground} /></Pressable>
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

      <Pressable onPress={() => setServerPickerOpen(true)} style={({ pressed }) => [styles.optionBar, { backgroundColor: colors.primary }, pressed && styles.pressed]}><View style={styles.optionIcon}><Ionicons name="server-outline" size={21} color={colors.primaryForeground} /></View><View style={styles.optionCopy}><Text style={styles.optionText}>{fastestStatus === 'finding' ? 'Finding fastest server...' : selectedServer ? selectedServer.flag + '  ' + selectedServer.name : 'Servers'}</Text><Text style={styles.optionMeta}>{fastestMessage || selectedServer?.country || 'Select a server'}</Text></View><Ionicons name="chevron-forward" size={19} color={colors.primaryForeground} /></Pressable>
      <Pressable onPress={() => setConfigPickerOpen(true)} style={({ pressed }) => [styles.optionBar, { backgroundColor: colors.primary }, pressed && styles.pressed]}><View style={styles.optionIcon}><Ionicons name="layers-outline" size={21} color={colors.primaryForeground} /></View><View style={styles.optionCopy}><Text style={styles.optionText}>{selectedConfig ? selectedConfig.flag + '  ' + selectedConfig.name : 'Configs'}</Text><Text style={styles.optionMeta}>{selectedConfig?.country ?? 'Select a configuration'}</Text></View><Ionicons name="chevron-forward" size={19} color={colors.primaryForeground} /></Pressable>
      <View style={[styles.timeBar, { backgroundColor: colors.primary }]}><View style={styles.timeCopy}><Ionicons name="time-outline" size={22} color={colors.primaryForeground} /><Text style={styles.timeText}>{isAccessExpired ? '00:00:00' : formatTime(accessRemainingSeconds)}</Text></View><Pressable onPress={() => setRewardOpen(true)} style={({ pressed }) => [styles.addTime, { backgroundColor: colors.background }, pressed && styles.pressed]}><Text style={[styles.addTimeText, { color: colors.foreground }]}>ADD TIME</Text><Ionicons name="add" size={16} color={colors.primary} /></Pressable></View>
      {failed ? <View style={[styles.statusNote, { borderColor: colors.border, backgroundColor: colors.accent }]}><Pill tone="red">CONNECTION FAILED</Pill><Text style={[styles.statusNoteText, { color: colors.accentForeground }]}>The VPN backend did not confirm a tunnel connection.</Text></View> : null}
    </View>

    <ModalShell visible={serverPickerOpen} title="Choose a server" subtitle="Select a built-in or saved custom server." onClose={() => { setServerPickerOpen(false); setServerQuery(''); }}><TextInput value={serverQuery} onChangeText={setServerQuery} placeholder="Search servers" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" style={[styles.searchInput, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]} /><View style={styles.serverList}>{visibleServers.map((server) => <Pressable key={server.id} testID={'home-server-' + server.id} onPress={() => { if (server.id === 'random-fastest') { void findFastestServer(); } else { selectServer(server.id); } setServerPickerOpen(false); setServerQuery(''); }} style={({ pressed }) => [styles.serverOption, { backgroundColor: server.id === selectedServerId ? colors.accent : colors.secondary, borderColor: server.id === selectedServerId ? colors.primary : colors.border }, pressed && styles.pressed]}><View style={{ flex: 1 }}><Text style={[styles.serverName, { color: colors.foreground }]}>{server.flag}  {server.name}</Text><Text style={[styles.serverLocation, { color: colors.mutedForeground }]}>{server.country}{server.isCustom ? ' • Custom' : ''}</Text></View>{server.id === selectedServerId ? <Ionicons name="checkmark-circle" size={19} color={colors.primary} /> : null}</Pressable>)}{visibleServers.length === 0 ? <Text style={[styles.serverLocation, { color: colors.mutedForeground }]}>No servers match that search.</Text> : null}</View></ModalShell>
    <ModalShell visible={configPickerOpen} title="Choose a configuration" subtitle="Select a built-in or saved custom tweak." onClose={() => { setConfigPickerOpen(false); setConfigQuery(''); }}><TextInput value={configQuery} onChangeText={setConfigQuery} placeholder="Search configs" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" style={[styles.searchInput, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]} /><View style={styles.serverList}>{visibleConfigs.map((config) => <Pressable key={config.id} testID={'home-config-' + config.id} onPress={() => { selectConfig(config.id); setConfigPickerOpen(false); setConfigQuery(''); }} style={({ pressed }) => [styles.serverOption, { backgroundColor: config.id === selectedConfigId ? colors.accent : colors.secondary, borderColor: config.id === selectedConfigId ? colors.primary : colors.border }, pressed && styles.pressed]}><View style={{ flex: 1 }}><Text style={[styles.serverName, { color: colors.foreground }]}>{config.flag}  {config.name}</Text><Text style={[styles.serverLocation, { color: colors.mutedForeground }]}>{config.country} • {config.connectionType}{config.isCustom ? ' • Custom' : ''}</Text></View>{config.id === selectedConfigId ? <Ionicons name="checkmark-circle" size={19} color={colors.primary} /> : null}</Pressable>)}{visibleConfigs.length === 0 ? <Text style={[styles.serverLocation, { color: colors.mutedForeground }]}>No configs match that search.</Text> : null}</View></ModalShell>
    <ModalShell visible={rewardOpen} title="Earn VPN access" subtitle="Add 4 hours of local VPN access time. AdMob can replace this later; no backend is required for the timer." onClose={() => setRewardOpen(false)}><View style={[styles.modalNote, { backgroundColor: colors.secondary }]}><Ionicons name="time-outline" size={22} color={colors.primary} /><Text style={[styles.modalNoteText, { color: colors.mutedForeground }]}>This grants time on-device using accessExpiresAt. Rewarded ads are not connected yet.</Text></View><PrimaryButton title="ADD 4 HOURS" icon="add-circle-outline" onPress={() => { grantAccess(4); setRewardOpen(false); Alert.alert('+4 hours VPN access', 'Local access time was extended by 4 hours.'); }} /></ModalShell>
    <ModalShell visible={actionMenuOpen} title="App actions" subtitle="Aries Tunnel tools and app information." onClose={() => setActionMenuOpen(false)}><View style={styles.actionList}><MenuAction icon="cloud-download-outline" label="Update Config" colors={colors} onPress={() => { void runConfigUpdate(); }} /><MenuAction icon="information-circle-outline" label="About" colors={colors} onPress={() => { setActionMenuOpen(false); setAboutOpen(true); }} /><MenuAction icon="exit-outline" label="Exit" colors={colors} onPress={() => { setActionMenuOpen(false); exitApp(); }} /></View></ModalShell>
    <ModalShell visible={aboutOpen} title="About Aries Tunnel" subtitle="Application information" onClose={() => setAboutOpen(false)}><View style={styles.aboutContent}><Image source={require('../../assets/images/icon.png')} style={styles.aboutLogo} /><Text style={[styles.aboutName, { color: colors.foreground }]}>Aries Tunnel</Text><Text style={[styles.aboutLine, { color: colors.mutedForeground }]}>App version {Constants.expoConfig?.version ?? '1.0.0'}</Text><Text style={[styles.aboutLine, { color: colors.mutedForeground }]}>Config version {configVersion}</Text></View></ModalShell>
    <Modal visible={menuOpen} transparent animationType="none" onRequestClose={() => setMenuOpen(false)}><View style={styles.drawerRoot}><Pressable style={styles.drawerBackdrop} onPress={() => setMenuOpen(false)} /><View style={[styles.drawer, { backgroundColor: colors.card, paddingTop: insets.top + 14 }]}><View style={styles.drawerHeader}><View style={[styles.drawerMark, { backgroundColor: colors.primary }]}><Ionicons name="shield-checkmark" size={22} color={colors.primaryForeground} /></View><View style={{ flex: 1 }}><Text style={[styles.drawerBrand, { color: colors.foreground }]}>ARIES TUNNEL</Text><Text style={[styles.drawerSubtitle, { color: colors.mutedForeground }]}>VPN CONTROL CENTER</Text></View><Pressable onPress={() => setMenuOpen(false)} hitSlop={10}><Ionicons name="close" size={21} color={colors.mutedForeground} /></Pressable></View><ForwardToggle icon="git-network-outline" label="Forward DNS" value={settings.forwardDns} colors={colors} onToggle={() => toggleSetting('forwardDns')} onOpen={() => { if (!settings.forwardDns) toggleSetting('forwardDns'); setMenuOpen(false); setForwardEditor('dns'); }} /><ForwardToggle icon="share-social-outline" label="Forward UDP" value={settings.forwardUdp} colors={colors} onToggle={() => toggleSetting('forwardUdp')} onOpen={() => { if (!settings.forwardUdp) toggleSetting('forwardUdp'); setMenuOpen(false); setForwardEditor('udp'); }} /><DrawerToggle icon="hardware-chip-outline" label="CPU Wakelock" value={settings.cpuWakelock} onChange={() => toggleSetting('cpuWakelock')} colors={colors} /><DrawerAction icon="wifi-outline" label="Hotspot Share" colors={colors} onPress={() => { setMenuOpen(false); router.push('/hotspot'); }} /><DrawerAction icon="settings-outline" label="Settings" colors={colors} onPress={() => { setMenuOpen(false); router.push('/settings'); }} /><DrawerAction icon="add-circle-outline" label="Add Server" colors={colors} onPress={() => { setMenuOpen(false); router.push('/(tabs)/servers'); }} /><DrawerAction icon="sliders-outline" label="Tweaks" colors={colors} onPress={() => { setMenuOpen(false); router.push('/(tabs)/tweaks'); }} /><View style={[styles.drawerDivider, { backgroundColor: colors.border }]} /><DrawerAction icon="list-outline" label="VPN Logs" colors={colors} onPress={() => { setMenuOpen(false); router.push('/(tabs)/logs'); }} /><DrawerAction icon="pulse-outline" label="Response Checker" colors={colors} onPress={() => { setMenuOpen(false); router.push('/response-checker'); }} /><DrawerAction icon="trash-outline" label="Clear App data" colors={colors} onPress={() => Alert.alert('Clear app data?', 'This resets access time, logs, selections, and local preferences.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: () => { clearAppData(); setMenuOpen(false); } }])} /><DrawerAction icon="warning-outline" label="Report Bug" colors={colors} onPress={() => Alert.alert('Report Bug', 'Bug reporting has not been configured yet.')} /><Text style={[styles.drawerFooter, { color: colors.mutedForeground }]}>Only use authorized VPN endpoints and credentials.</Text></View></View></Modal>
    <ModalShell visible={forwardEditor !== null} title={forwardEditor === 'dns' ? 'Forward DNS' : 'Forward UDP'} subtitle="Saved locally for the authorized tunnel backend. These values do not create an unauthorized relay." onClose={() => setForwardEditor(null)}><View style={styles.forwardEditor}>{forwardEditor === 'dns' ? <><TextInput value={settings.customDns} onChangeText={(value) => updateSetting('customDns', value)} placeholder="Custom DNS servers (comma separated)" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" style={[styles.forwardInput, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]} /><Text style={[styles.forwardHint, { color: colors.mutedForeground }]}>Example: 1.1.1.1, 8.8.8.8</Text></> : <><TextInput value={settings.customUdpHost} onChangeText={(value) => updateSetting('customUdpHost', value)} placeholder="Custom UDP host" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" style={[styles.forwardInput, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]} /><TextInput value={settings.customUdpPort} onChangeText={(value) => updateSetting('customUdpPort', value.replace(/[^0-9]/g, ''))} placeholder="UDP port" placeholderTextColor={colors.mutedForeground} keyboardType="number-pad" style={[styles.forwardInput, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]} /><Text style={[styles.forwardHint, { color: colors.mutedForeground }]}>Leave the host empty to use the server profile’s UDP settings.</Text></>}<PrimaryButton title="SAVE SETTINGS" icon="checkmark" onPress={() => setForwardEditor(null)} /></View></ModalShell>

  </Screen>;
}

function formatTime(total: number) {
  const hours = Math.floor(total / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
  const seconds = Math.floor(total % 60).toString().padStart(2, '0');
  return hours + ':' + minutes + ':' + seconds;
}

function TrafficStat({ icon, value, label, colors, align = 'left' }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string; colors: ReturnType<typeof useColors>; align?: 'left' | 'right' }) {
  return <View style={[styles.trafficStat, align === 'right' && styles.trafficRight]}><Ionicons name={icon} size={16} color={colors.mutedForeground} /><View><Text style={[styles.trafficValue, { color: colors.foreground }]}>{value}</Text><Text style={[styles.trafficLabel, { color: colors.mutedForeground }]}>{label}</Text></View></View>;
}

function DrawerToggle({ icon, label, value, onChange, colors }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: boolean; onChange: () => void; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.drawerRow}><View style={[styles.drawerIcon, { backgroundColor: colors.secondary }]}><Ionicons name={icon} size={17} color={colors.primary} /></View><Text style={[styles.drawerLabel, { color: colors.foreground }]}>{label}</Text><Switch value={value} onValueChange={onChange} trackColor={{ false: colors.secondary, true: colors.accent }} thumbColor={value ? colors.primary : colors.mutedForeground} /></View>;
}

function ForwardToggle({ icon, label, value, onToggle, onOpen, colors }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: boolean; onToggle: (value: boolean) => void; onOpen: () => void; colors: ReturnType<typeof useColors> }) {
  return <Pressable onPress={onOpen} style={({ pressed }) => [styles.drawerRow, pressed && styles.pressed]}><View style={[styles.drawerIcon, { backgroundColor: colors.secondary }]}><Ionicons name={icon} size={17} color={colors.primary} /></View><Text style={[styles.drawerLabel, { color: colors.foreground }]}>{label}</Text>{value ? <Ionicons name="create-outline" size={17} color={colors.mutedForeground} /> : null}<Switch value={value} onValueChange={(nextValue) => { onToggle(nextValue); if (nextValue) onOpen(); }} trackColor={{ false: colors.secondary, true: colors.accent }} thumbColor={value ? colors.primary : colors.mutedForeground} /></Pressable>;
}

function MenuAction({ icon, label, colors, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; colors: ReturnType<typeof useColors>; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.menuAction, { backgroundColor: colors.secondary }, pressed && styles.pressed]}><Ionicons name={icon} size={19} color={colors.primary} /><Text style={[styles.menuActionText, { color: colors.foreground }]}>{label}</Text><Ionicons name="chevron-forward" size={17} color={colors.mutedForeground} /></Pressable>;
}

function DrawerAction({ icon, label, colors, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; colors: ReturnType<typeof useColors>; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.drawerRow, pressed && styles.pressed]}><View style={[styles.drawerIcon, { backgroundColor: colors.secondary }]}><Ionicons name={icon} size={17} color={colors.primary} /></View><Text style={[styles.drawerLabel, { color: colors.foreground }]}>{label}</Text></Pressable>;
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
  timeBar: { minHeight: 55, borderRadius: 28, paddingLeft: 16, paddingRight: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeCopy: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  timeText: { color: '#ffffff', fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 0.5 },
  addTime: { minHeight: 41, minWidth: 112, borderRadius: 22, paddingHorizontal: 14, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center' },
  addTimeText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.5 },
  statusNote: { marginTop: 14, padding: 12, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  statusNoteText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  searchInput: { minHeight: 44, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 14 },
  serverList: { gap: 9, marginTop: 16 },
  serverOption: { minHeight: 62, borderRadius: 15, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' },
  serverName: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  serverLocation: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  modalNote: { flexDirection: 'row', gap: 10, borderRadius: 16, padding: 14, marginVertical: 18 },
  modalNoteText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  actionList: { gap: 10 },
  menuAction: { minHeight: 54, borderRadius: 16, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuActionText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  aboutContent: { alignItems: 'center', paddingVertical: 8 },
  aboutLogo: { width: 84, height: 84, borderRadius: 20, marginBottom: 14 },
  aboutName: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  aboutLine: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 7 },
  forwardEditor: { gap: 10, paddingTop: 14 },
  forwardInput: { minHeight: 52, borderRadius: 15, borderWidth: 1, paddingHorizontal: 14, fontFamily: 'Inter_400Regular', fontSize: 13 },
  forwardHint: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, marginBottom: 8 },
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
  drawerDivider: { height: 1, marginVertical: 11 },
  drawerFooter: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 16, marginTop: 18, paddingBottom: 24 },
});