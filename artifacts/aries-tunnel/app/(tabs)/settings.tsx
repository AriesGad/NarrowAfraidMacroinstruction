import React, { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Header, Row, Screen, Surface } from '@/components/Primitives';
import { useAppState } from '@/context/AppStateContext';
import { useColors } from '@/hooks/useColors';

const settingGroups = [
  { title: 'Tunnel behavior', items: [{ key: 'forwardUdp', icon: 'git-network-outline' as const, title: 'Forward UDP', detail: 'Allow UDP traffic through the tunnel' }, { key: 'forwardDns', icon: 'at-outline' as const, title: 'Forward DNS', detail: 'Route DNS requests through the tunnel' }, { key: 'mobileNetwork', icon: 'phone-portrait-outline' as const, title: 'Mobile network', detail: 'Allow cellular network usage' }] },
  { title: 'Device behavior', items: [{ key: 'notificationSound', icon: 'volume-high-outline' as const, title: 'Notification sound', detail: 'Play connection status sounds' }, { key: 'vibrate', icon: 'pulse-outline' as const, title: 'Vibrate', detail: 'Use haptics for primary actions' }, { key: 'cpuWakelock', icon: 'hardware-chip-outline' as const, title: 'CPU wakelock', detail: 'Native Android service implementation required' }, { key: 'batteryOptimization', icon: 'battery-half-outline' as const, title: 'Battery optimization', detail: 'Native Android permission flow required' }] },
  { title: 'Sharing', items: [{ key: 'shareHotspot', icon: 'wifi-outline' as const, title: 'Share hotspot', detail: 'Open VPN hotspot sharing status' }] },
] as const;

type SettingKey = 'forwardUdp' | 'notificationSound' | 'vibrate' | 'cpuWakelock' | 'batteryOptimization' | 'forwardDns' | 'mobileNetwork' | 'shareHotspot';

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { settings, toggleSetting, clearAppData } = useAppState();
  const [confirming, setConfirming] = useState(false);
  return <Screen><Header eyebrow="Preferences" title="Settings" />
    {settingGroups.map((group) => <View key={group.title} style={styles.group}><Text style={[styles.groupTitle, { color: colors.foreground }]}>{group.title}</Text><Surface>{group.items.map((item) => <Row key={item.key} icon={item.icon} title={item.title} subtitle={item.detail} onPress={item.key === 'shareHotspot' ? () => router.push('/hotspot') : undefined} right={item.key === 'shareHotspot' ? <Text style={[styles.openText, { color: colors.primary }]}>OPEN</Text> : <Switch testID={'switch-' + item.key} value={settings[item.key as SettingKey]} onValueChange={() => toggleSetting(item.key as SettingKey)} trackColor={{ false: colors.secondary, true: colors.accent }} thumbColor={settings[item.key as SettingKey] ? colors.primary : colors.mutedForeground} />} />)}</Surface></View>)}
    <View style={styles.group}><Text style={[styles.groupTitle, { color: colors.foreground }]}>Data & advanced</Text><Surface><Row icon="construct-outline" title="Custom tweak" subtitle="Managed from the Tweaks tab" right={<Text style={[styles.openText, { color: colors.primary }]}>OPEN</Text>} onPress={() => router.push('/(tabs)/tweaks')} /><Row icon="server-outline" title="Custom server" subtitle="Managed from the Servers tab" right={<Text style={[styles.openText, { color: colors.primary }]}>OPEN</Text>} onPress={() => router.push('/(tabs)/servers')} /><Row icon="pulse-outline" title="Response checker" subtitle="Authorized endpoints only" right={<Text style={[styles.openText, { color: colors.primary }]}>OPEN</Text>} onPress={() => router.push('/response-checker')} /><Row icon="trash-outline" title="Clear app data" subtitle="Reset local preferences and access time" right={<Text style={[styles.clearText, { color: colors.primary }]}>{confirming ? 'CONFIRM' : 'CLEAR'}</Text>} onPress={() => { if (confirming) { clearAppData(); setConfirming(false); Alert.alert('App data cleared', 'Your local settings, server selection, logs, and access time were reset.'); } else setConfirming(true); }} /></Surface></View>
    <Text style={[styles.footer, { color: colors.mutedForeground }]}>Aries Tunnel • UI prototype • No credentials or private keys are stored in ordinary app data.</Text>
  </Screen>;
}

const styles = StyleSheet.create({ group: { marginBottom: 24 }, groupTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, marginBottom: 11 }, openText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.6 }, clearText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.6 }, footer: { textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, paddingHorizontal: 20, marginBottom: 18 },
});
