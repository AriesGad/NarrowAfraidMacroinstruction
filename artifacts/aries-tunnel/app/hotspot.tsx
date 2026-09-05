import React from 'react';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Surface } from '@/components/Primitives';
import { useAppState } from '@/context/AppStateContext';
import { useColors } from '@/hooks/useColors';

export default function HotspotScreen() {
  const colors = useColors();
  const router = useRouter();
  const { settings, status, toggleSetting } = useAppState();
  const proxy = '192.168.170.192';
  const port = '8080';
  const copy = async (value: string, label: string) => { await Clipboard.setStringAsync(value); Alert.alert(label + ' copied', 'The value is ready to paste into the other device’s proxy settings.'); };
  const openHotspotSettings = async () => {
    if (Platform.OS === 'android') {
      try {
        await Linking.sendIntent('android.settings.TETHER_SETTINGS');
      } catch {
        await Linking.openSettings();
      }
      return;
    }
    Alert.alert('Hotspot settings', 'Hotspot settings can only be opened directly on an Android device.');
  };
  const toggleShare = () => {
    if (settings.shareHotspot) {
      toggleSetting('shareHotspot');
      return;
    }
    if (status !== 'connected') {
      Alert.alert('VPN share unavailable', 'Connect this phone to a real VPN first. Aries Tunnel cannot start a hotspot share without an active native VPN service.');
      return;
    }
    toggleSetting('shareHotspot');
  };
  const sharing = settings.shareHotspot;
  return <Screen>
    <View style={styles.topBar}>
      <Pressable accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.backButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}><Ionicons name="chevron-back" size={22} color={colors.foreground} /></Pressable>
      <Text style={[styles.topTitle, { color: colors.foreground }]}>Share Hotspot</Text>
      <View style={styles.topBarSpacer} />
    </View>
    <Surface style={styles.statusCard}><View style={[styles.statusIcon, { backgroundColor: colors.accent }]}><Ionicons name="wifi-outline" size={25} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={[styles.statusTitle, { color: colors.foreground }]}>{sharing ? 'Hotshare Enabled' : 'Hotshare Disabled'}</Text><Text style={[styles.statusText, { color: colors.mutedForeground }]}>{sharing ? 'VPN traffic sharing is requested for the active native service.' : 'Turn on your phone hotspot, then start VPN share.'}</Text></View></Surface>
    <Surface style={styles.detailsCard}><View style={styles.detailLine}><Text style={[styles.detailLabel, { color: colors.foreground }]}>Hostname:</Text><Text style={[styles.detailValue, { color: colors.primary }]}>{proxy}</Text></View><View style={styles.detailLine}><Text style={[styles.detailLabel, { color: colors.foreground }]}>Proxy Port:</Text><Text style={[styles.detailValue, { color: colors.primary }]}>{port}</Text></View></Surface>
    <View style={styles.actionRow}><Pressable testID="start-vpn-share" onPress={toggleShare} style={({ pressed }) => [styles.shareButton, { borderColor: colors.primary }, pressed && styles.pressed]}><Text style={[styles.shareButtonText, { color: colors.foreground }]}>{sharing ? 'Stop VPN Share' : 'Start VPN Share'}</Text></Pressable><Pressable testID="open-hotspot-settings" accessibilityLabel="Open phone hotspot settings" onPress={() => { void openHotspotSettings(); }} hitSlop={10} style={({ pressed }) => [styles.gearButton, pressed && styles.pressed]}><Ionicons name="settings-sharp" size={26} color={colors.primary} /></Pressable></View>
    <Text style={[styles.instructionsTitle, { color: colors.foreground }]}>How to share VPN connection with other device</Text>
    <Step number="Step 1" colors={colors}>Connect this phone to the VPN, turn on your phone’s Hotspot (tap the gear icon above to open hotspot settings), then tap “Start VPN Share”.</Step>
    <Step number="Step 2" colors={colors}>1. Connect the other device to this phone’s Wi-Fi hotspot using its password.{'\n'}2. Set up a proxy on that connected device.</Step>
    <Text style={[styles.noteText, { color: colors.mutedForeground }]}>You do not need to install this app on the other device.</Text>
    <Step number="Step 3" colors={colors}>On the other device open Settings → Connections → Wi-Fi, long press the Wi-Fi name you just chose and choose Manage network settings. Open the advanced options, set Proxy to “Manual”, then enter the Hostname and Proxy Port shown at the top of this screen and save.{'\n\n'}On a computer: open your system proxy settings, enable “Use a proxy server”, enter the same Hostname and Port, and save.</Step>
    <Text style={[styles.noteText, { color: colors.mutedForeground }]}>Tap “Stop VPN Share” when you are done.</Text>
  </Screen>;
}

function Step({ number, children, colors }: { number: string; children: React.ReactNode; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.step}><Text style={[styles.stepNumber, { color: colors.mutedForeground }]}>{number}</Text><Text style={[styles.stepText, { color: colors.mutedForeground }]}>{children}</Text></View>;
}

const styles = StyleSheet.create({
  topBar: { minHeight: 54, flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  backButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 20, marginLeft: 15 },
  topBarSpacer: { width: 42, height: 42 },
  statusCard: { minHeight: 88, flexDirection: 'row', gap: 13, alignItems: 'center', borderRadius: 20, paddingVertical: 20, paddingHorizontal: 18 },
  statusIcon: { width: 45, height: 45, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  statusText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 6 },
  detailsCard: { marginTop: 16, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 18 },
  detailLine: { minHeight: 47, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  detailValue: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20 },
  shareButton: { flex: 1, minHeight: 52, borderRadius: 27, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  shareButtonText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  gearButton: { width: 42, height: 52, alignItems: 'center', justifyContent: 'center' },
  instructionsTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, lineHeight: 22, marginTop: 23, marginBottom: 16 },
  step: { marginBottom: 17 },
  stepNumber: { fontFamily: 'Inter_500Medium', fontSize: 13, marginBottom: 7 },
  stepText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  noteText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginBottom: 18 },
  pressed: { opacity: 0.72 },
});
