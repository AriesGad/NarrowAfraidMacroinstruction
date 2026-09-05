import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ModalShell } from '@/components/ModalShell';
import { Header, Label, PrimaryButton, Screen, Surface } from '@/components/Primitives';
import { useAppState } from '@/context/AppStateContext';
import { useColors } from '@/hooks/useColors';

const profiles = [
  { name: 'Default', detail: 'Balanced routing and DNS behavior', icon: 'options-outline' as const },
  { name: 'Stable', detail: 'Prioritizes reliability over speed', icon: 'shield-checkmark-outline' as const },
  { name: 'Fast', detail: 'Prefers the lowest measured latency', icon: 'flash-outline' as const },
  { name: 'Low Data', detail: 'Conservative background traffic', icon: 'cellular-outline' as const },
  { name: 'Custom', detail: 'A future home for your own profile', icon: 'construct-outline' as const },
];

export default function TweaksScreen() {
  const colors = useColors();
  const { selectedProfile, selectProfile } = useAppState();
  const [customOpen, setCustomOpen] = useState(false);
  const [checkerOpen, setCheckerOpen] = useState(false);
  const [checkerStatus, setCheckerStatus] = useState<'idle' | 'ready'>('idle');
  return <Screen><Header eyebrow="Configuration" title="Tweaks" />
    <Surface><Label>Active profile</Label><Text style={[styles.activeProfile, { color: colors.primary }]}>{selectedProfile}</Text><Text style={[styles.description, { color: colors.mutedForeground }]}>Profiles are local presets. They do not alter a tunnel until a legitimate VPN backend consumes them.</Text></Surface>
    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Profiles</Text>
    <View style={styles.profileList}>{profiles.map((profile) => <Pressable key={profile.name} testID={'profile-' + profile.name} onPress={() => { selectProfile(profile.name); if (profile.name === 'Custom') setCustomOpen(true); }} style={({ pressed }) => [styles.profile, { backgroundColor: selectedProfile === profile.name ? colors.accent : colors.card, borderColor: selectedProfile === profile.name ? colors.primary : colors.border }, pressed && styles.pressed]}><View style={[styles.profileIcon, { backgroundColor: colors.secondary }]}><Ionicons name={profile.icon} size={19} color={selectedProfile === profile.name ? colors.primary : colors.mutedForeground} /></View><View style={{ flex: 1 }}><Text style={[styles.profileName, { color: colors.foreground }]}>{profile.name}</Text><Text style={[styles.profileDetail, { color: colors.mutedForeground }]}>{profile.detail}</Text></View>{selectedProfile === profile.name ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}</Pressable>)}</View>
    <View style={styles.actionGrid}><Pressable onPress={() => setCustomOpen(true)} style={({ pressed }) => [styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}><Ionicons name="construct-outline" size={21} color={colors.primary} /><Text style={[styles.actionTitle, { color: colors.foreground }]}>Custom tweak</Text><Text style={[styles.actionDetail, { color: colors.mutedForeground }]}>Build a profile later</Text></Pressable><Pressable onPress={() => setCheckerOpen(true)} style={({ pressed }) => [styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}><Ionicons name="pulse-outline" size={21} color={colors.primary} /><Text style={[styles.actionTitle, { color: colors.foreground }]}>Response checker</Text><Text style={[styles.actionDetail, { color: colors.mutedForeground }]}>Authorized endpoints only</Text></Pressable></View>
    <ModalShell visible={customOpen} title="Custom tweak" subtitle="This modular slot is ready for real protocol parameters when a backend is connected." onClose={() => setCustomOpen(false)}><View style={[styles.modalMessage, { backgroundColor: colors.secondary }]}><Ionicons name="options-outline" size={22} color={colors.primary} /><Text style={[styles.modalMessageText, { color: colors.mutedForeground }]}>No network behavior is changed by this prototype. Your selected profile is saved locally.</Text></View><PrimaryButton title="CLOSE" onPress={() => setCustomOpen(false)} secondary /></ModalShell>
    <ModalShell visible={checkerOpen} title="Response checker" subtitle="Only test a server or endpoint that you own or are explicitly authorized to test." onClose={() => setCheckerOpen(false)}><View style={[styles.modalMessage, { backgroundColor: colors.secondary }]}><Ionicons name="lock-closed-outline" size={22} color={colors.primary} /><Text style={[styles.modalMessageText, { color: colors.mutedForeground }]}>{checkerStatus === 'ready' ? 'The checker interface is ready for an authorized endpoint in the next backend stage.' : 'No endpoint is configured. Add an authorized endpoint before running a check.'}</Text></View><PrimaryButton title={checkerStatus === 'ready' ? 'CHECK COMPLETE' : 'NO ENDPOINT CONFIGURED'} icon="pulse" disabled onPress={() => setCheckerStatus('ready')} /></ModalShell>
  </Screen>;
}

const styles = StyleSheet.create({
  activeProfile: { fontFamily: 'Inter_700Bold', fontSize: 22, marginTop: 9 },
  description: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 8 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, marginTop: 28, marginBottom: 12 },
  profileList: { gap: 10 },
  profile: { minHeight: 74, borderRadius: 19, borderWidth: 1, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  profileName: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  profileDetail: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  actionGrid: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionCard: { flex: 1, borderWidth: 1, borderRadius: 19, padding: 15, minHeight: 125 },
  actionTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, marginTop: 17 },
  actionDetail: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 5 },
  modalMessage: { flexDirection: 'row', gap: 10, padding: 15, borderRadius: 16, marginVertical: 18 },
  modalMessageText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.75 },
});
