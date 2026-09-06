import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Linking, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Surface } from '@/components/Primitives';
import { useAppState } from '@/context/AppStateContext';
import { useColors } from '@/hooks/useColors';

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { settings, toggleSetting, clearAppData, clearLogs } = useAppState();
  const [busy, setBusy] = useState(false);

  const openBatterySettings = async () => {
    if (Platform.OS === 'android') {
      try {
        await Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
        return;
      } catch {
        await Linking.openSettings();
        return;
      }
    }
    Alert.alert('Battery optimization', 'Battery settings can only be opened directly on Android.');
  };

  return <Screen>
    <View style={styles.topBar}>
      <Pressable accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.backButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}><Ionicons name="chevron-back" size={22} color={colors.foreground} /></Pressable>
      <Text style={[styles.topTitle, { color: colors.foreground }]}>Settings</Text>
      <View style={styles.spacer} />
    </View>
    <Surface style={styles.card}>
      <ToggleRow icon="flash-outline" label="Custom Tweak" value={settings.customTweak} onChange={() => toggleSetting('customTweak')} colors={colors} />
      <ToggleRow icon="share-social-outline" label="Forward UDP" value={settings.forwardUdp} onChange={() => toggleSetting('forwardUdp')} colors={colors} />
      <ToggleRow icon="volume-high-outline" label="Notification Sound" value={settings.notificationSound} onChange={() => toggleSetting('notificationSound')} colors={colors} />
      <ToggleRow icon="phone-portrait-outline" label="Vibrate" value={settings.vibrate} onChange={() => toggleSetting('vibrate')} colors={colors} />
      <ToggleRow icon="hardware-chip-outline" label="CPU Wakelock" value={settings.cpuWakelock} onChange={() => toggleSetting('cpuWakelock')} colors={colors} />
      <ToggleRow icon="battery-charging-outline" label="Battery Optimization" value={settings.batteryOptimization} onChange={() => { toggleSetting('batteryOptimization'); void openBatterySettings(); }} colors={colors} />
      <ToggleRow icon="git-network-outline" label="Forward DNS" value={settings.forwardDns} onChange={() => toggleSetting('forwardDns')} colors={colors} />
      <ToggleRow icon="cellular-outline" label="Mobile Network" value={settings.mobileNetwork} onChange={() => toggleSetting('mobileNetwork')} colors={colors} />
      <ToggleRow icon="wifi-outline" label="Share Hotspot" value={settings.shareHotspot} onChange={() => toggleSetting('shareHotspot')} colors={colors} />
    </Surface>
    <Surface style={styles.card}>
      <ActionRow icon="add-circle-outline" label="Custom Server" colors={colors} onPress={() => router.push('/(tabs)/servers')} />
      <ActionRow icon="sliders-outline" label="Tweaks" colors={colors} onPress={() => router.push('/(tabs)/tweaks')} />
      <ActionRow icon="pulse-outline" label="Response Checker" colors={colors} onPress={() => router.push('/response-checker')} />
      <ActionRow icon="list-outline" label="VPN Logs" colors={colors} onPress={() => router.push('/(tabs)/logs')} />
      <ActionRow icon="trash-outline" label="Clear Logs" colors={colors} onPress={() => { clearLogs(); Alert.alert('Logs cleared', 'VPN log events were removed.'); }} />
      <ActionRow icon="refresh-outline" label="Clear App Data" colors={colors} onPress={() => Alert.alert('Clear app data?', 'This resets access time, logs, selections, custom servers, tweaks, and local preferences.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: () => { setBusy(true); clearAppData(); setBusy(false); Alert.alert('App data cleared', 'Local settings were reset.'); } }])} />
    </Surface>
    <Text style={[styles.note, { color: colors.mutedForeground }]}>{busy ? 'Resetting…' : 'These settings are stored on this device. No VPN backend is connected yet.'}</Text>
  </Screen>;
}

function ToggleRow({ icon, label, value, onChange, colors }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: boolean; onChange: () => void; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.row}><View style={[styles.icon, { backgroundColor: colors.secondary }]}><Ionicons name={icon} size={17} color={colors.primary} /></View><Text style={[styles.label, { color: colors.foreground }]}>{label}</Text><Switch value={value} onValueChange={onChange} trackColor={{ false: colors.secondary, true: colors.accent }} thumbColor={value ? colors.primary : colors.mutedForeground} /></View>;
}

function ActionRow({ icon, label, colors, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; colors: ReturnType<typeof useColors>; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><View style={[styles.icon, { backgroundColor: colors.secondary }]}><Ionicons name={icon} size={17} color={colors.primary} /></View><Text style={[styles.label, { color: colors.foreground }]}>{label}</Text><Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} /></Pressable>;
}

const styles = StyleSheet.create({
  topBar: { minHeight: 54, flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  backButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 20, marginLeft: 15 },
  spacer: { width: 42, height: 42 },
  card: { marginBottom: 14, paddingVertical: 6, paddingHorizontal: 8 },
  row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8 },
  icon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13 },
  note: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 4, marginBottom: 24 },
  pressed: { opacity: 0.7 },
});
