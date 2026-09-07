import React, { useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field, FieldLabel, RadioOption, SelectRow, ChipRow } from '@/components/FormFields';
import { PrimaryButton, Surface } from '@/components/Primitives';
import { CustomTweakInput, Tweak, useAppState } from '@/context/AppStateContext';
import { useColors } from '@/hooks/useColors';
import { checkEndpoint } from '@/services/responseChecker';

const TUNNELS = ['OPENVPN/SSH', 'V2RAY', 'DNSTT', 'UDP HYSTERIA'] as const;
const TYPES: Tweak['connectionType'][] = ['Direct SSH', 'SSL/TLS', 'HTTP', 'WebSocket'];
const TEMPLATES = ['Direct', 'Direct Payload', 'WebSocket', 'HTTP Proxy'] as const;
const TLS_VERSIONS = ['Default', 'TLS 1.2', 'TLS 1.3'];
const PAYLOADS: Record<typeof TEMPLATES[number], string> = {
  Direct: '',
  'Direct Payload': 'GET / HTTP/1.1[crlf]Host: [host][crlf][crlf]',
  WebSocket: 'GET / HTTP/1.1[crlf]Host: [host][crlf]Upgrade: websocket[crlf]Connection: Upgrade[crlf][crlf]',
  'HTTP Proxy': 'CONNECT [host]:[port] HTTP/1.1[crlf]Host: [host][crlf][crlf]',
};

const LABEL_COLORS: Record<string, string> = {
  CF: '#4db8ff',
  WS: '#d94e4e',
};

function labelColor(label: string): string {
  return LABEL_COLORS[label.toUpperCase()] ?? '#9d9da6';
}

type FormState = {
  name: string;
  country: string;
  flag: string;
  tunnel: typeof TUNNELS[number];
  connectionType: Tweak['connectionType'];
  template: typeof TEMPLATES[number];
  payloadConfiguration: string;
  sni: string;
  host: string;
  port: string;
  proxyHost: string;
  proxyPort: string;
  tlsVersion: string;
  category: string;
  note: string;
};

const EMPTY: FormState = {
  name: '', country: 'Custom', flag: 'CUS', tunnel: 'OPENVPN/SSH', connectionType: 'Direct SSH', template: 'Direct',
  payloadConfiguration: '', sni: '', host: '', port: '443', proxyHost: '', proxyPort: '80', tlsVersion: 'Default', category: 'CF', note: '',
};

function fromTweak(tweak: Tweak): FormState {
  return {
    ...EMPTY,
    name: tweak.name,
    country: tweak.country,
    flag: tweak.flag,
    connectionType: tweak.connectionType,
    payloadConfiguration: tweak.payloadConfiguration,
    sni: tweak.sni,
    host: tweak.host,
    port: String(tweak.port || 443),
    proxyHost: tweak.proxyHost,
    proxyPort: String(tweak.proxyPort || 80),
    category: tweak.category ?? 'CF',
    note: tweak.note ?? '',
    template: tweak.connectionType === 'WebSocket' ? 'WebSocket' : tweak.connectionType === 'HTTP' ? 'HTTP Proxy' : tweak.payloadConfiguration ? 'Direct Payload' : 'Direct',
  };
}

export default function TweaksScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { remoteConfigs, remoteConfigMessage, remoteConfigStatus, customTweaks, selectedConfigId, selectConfig, updateConfig, addCustomTweak, editCustomTweak, duplicateTweak, deleteCustomTweak } = useAppState();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [lastMessage, setLastMessage] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const filteredRemote = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return remoteConfigs;
    return remoteConfigs.filter((c) => (c.name + ' ' + c.country + ' ' + (c.note ?? '') + ' ' + (c.category ?? '')).toLowerCase().includes(q));
  }, [remoteConfigs, query]);

  const custom = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customTweaks;
    return customTweaks.filter((t) => (t.name + ' ' + t.connectionType + ' ' + t.host).toLowerCase().includes(q));
  }, [customTweaks, query]);

  const reset = () => {
    setEditingId(null);
    setForm(EMPTY);
  };

  const fill = (tweak: Tweak) => {
    setEditingId(tweak.isCustom ? tweak.id : null);
    setForm(fromTweak(tweak));
  };

  const applyTemplate = (template: typeof TEMPLATES[number]) => {
    const connectionType: Tweak['connectionType'] = template === 'WebSocket' ? 'WebSocket' : template === 'HTTP Proxy' ? 'HTTP' : form.connectionType === 'SSL/TLS' ? 'SSL/TLS' : 'Direct SSH';
    setForm((current) => ({ ...current, template, connectionType, payloadConfiguration: PAYLOADS[template] }));
  };

  const buildInput = (): CustomTweakInput | null => {
    if (!form.name.trim()) {
      Alert.alert('Name required', 'Enter a tweak name before saving.');
      return null;
    }
    return {
      name: form.name.trim(),
      country: form.country.trim() || 'Custom',
      flag: form.flag.trim() || 'CUS',
      connectionType: form.connectionType,
      host: form.host.trim(),
      port: Number(form.port) || 0,
      sni: form.sni.trim(),
      proxyHost: form.proxyHost.trim(),
      proxyPort: Number(form.proxyPort) || 0,
      payloadConfiguration: form.payloadConfiguration,
      category: form.category.trim() || 'CF',
      note: form.note.trim(),
    };
  };

  const save = () => {
    const input = buildInput();
    if (!input) return;
    if (editingId) editCustomTweak(editingId, input);
    else addCustomTweak(input);
    Alert.alert(editingId ? 'Tweak updated' : 'Tweak saved', input.name + ' is ready to select on Home.');
    reset();
  };

  const runTest = async (tweak: Tweak) => {
    if (!tweak.host) {
      Alert.alert('Nothing to test', 'This tweak has no host to check yet.');
      return;
    }
    try {
      const result = await checkEndpoint({ host: tweak.host, port: String(tweak.port || ''), sni: tweak.sni, proxyHost: tweak.proxyHost, proxyPort: String(tweak.proxyPort || ''), customHeaders: '', method: 'HEAD', proxyEnabled: Boolean(tweak.proxyHost) });
      Alert.alert(result.reachable ? 'Host reachable' : 'Host unreachable', tweak.name + ' • ' + (result.statusCode ? 'HTTP ' + result.statusCode : result.error ?? 'No HTTP response') + (result.responseTime !== null ? ' • ' + result.responseTime + ' ms' : ''));
    } catch (error) {
      Alert.alert('Test failed', error instanceof Error ? error.message : 'The host could not be checked.');
    }
  };

  const confirmDelete = (tweak: Tweak) => {
    Alert.alert('Delete tweak', 'Remove ' + tweak.name + ' from this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteCustomTweak(tweak.id); if (editingId === tweak.id) reset(); } },
    ]);
  };

  const runUpdate = async () => {
    setMenuOpen(false);
    const result = await updateConfig();
    if (result.success && remoteConfigMessage) {
      setLastMessage(remoteConfigMessage);
      setMessageOpen(true);
    } else {
      Alert.alert(result.success ? 'Config update' : 'Config update unavailable', result.message);
    }
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const isLoading = remoteConfigStatus === 'loading';
  const hasConfigs = remoteConfigs.length > 0;
  const showError = remoteConfigStatus === 'error' && !hasConfigs;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Custom header matching screenshot style */}
      <View style={[styles.headerBar, { backgroundColor: colors.card, paddingTop: Math.max(insets.top, 10) }]}>
        <Pressable onPress={() => router.navigate('/')} hitSlop={12} style={({ pressed }) => [styles.headerIcon, pressed && styles.pressed]}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Select Tweak</Text>
        <View style={styles.headerRight}>
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={12} style={({ pressed }) => [styles.headerIcon, pressed && styles.pressed]}>
            <Ionicons name="ellipsis-vertical" size={20} color={colors.foreground} />
          </Pressable>
        </View>
      </View>

      {/* Always-visible search bar — instant filter as you type */}
      <View style={[styles.searchRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search configs..."
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          style={[styles.searchInput, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]}
        />
      </View>

      <ScrollView ref={scrollRef} style={styles.scrollBody} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Remote config list — locked, matching screenshot */}
        <View style={styles.configList}>
          {isLoading && !hasConfigs ? (
            <View style={styles.statusBox}>
              <Text style={[styles.statusText, { color: colors.mutedForeground }]}>Loading configs...</Text>
            </View>
          ) : showError ? (
            <View style={styles.statusBox}>
              <Ionicons name="cloud-offline-outline" size={32} color={colors.mutedForeground} />
              <Text style={[styles.statusTitle, { color: colors.foreground }]}>No configs loaded</Text>
              <Text style={[styles.statusText, { color: colors.mutedForeground }]}>Please update to download the latest configs.</Text>
              <PrimaryButton title="UPDATE CONFIG" icon="cloud-download-outline" onPress={runUpdate} />
            </View>
          ) : hasConfigs ? (
            filteredRemote.map((config, index) => {
              const selected = config.id === selectedConfigId;
              const label = config.category ?? '';
              return (
                <Pressable
                  key={config.id}
                  testID={'remote-config-' + config.id}
                  onPress={() => selectConfig(config.id)}
                  style={({ pressed }) => [
                    styles.configItem,
                    { backgroundColor: selected ? colors.secondary : 'transparent', borderColor: colors.border },
                    pressed && styles.pressed,
                  ]}
                >
                  {selected ? <View style={styles.selectedBar} /> : null}
                  <View style={styles.configContent}>
                    <Text style={[styles.configName, { color: colors.foreground }]} numberOfLines={1}>
                      {config.flag ? config.flag + '  ' : ''}{config.name}
                    </Text>
                    {config.note ? <Text style={[styles.configSub, { color: colors.mutedForeground }]} numberOfLines={1}>{config.note}</Text> : null}
                  </View>
                  {label ? <Text style={[styles.configLabel, { color: labelColor(label) }]}>{label}</Text> : null}
                </Pressable>
              );
            })
          ) : (
            <View style={styles.statusBox}>
              <Ionicons name="cloud-outline" size={32} color={colors.mutedForeground} />
              <Text style={[styles.statusTitle, { color: colors.foreground }]}>No configs yet</Text>
              <Text style={[styles.statusText, { color: colors.mutedForeground }]}>Tap update to download the config list.</Text>
              <PrimaryButton title="UPDATE CONFIG" icon="cloud-download-outline" onPress={runUpdate} />
            </View>
          )}
        </View>

        {/* Custom tweaks section — existing functionality */}
        <Surface style={styles.listCard}>
          <Text style={[styles.section, { color: colors.foreground }]}>Saved custom tweaks</Text>
          {custom.length === 0 ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>No custom tweaks yet.</Text> : custom.map((tweak) => (
            <View key={tweak.id} testID={'custom-tweak-' + tweak.id} style={[styles.item, { borderColor: tweak.id === selectedConfigId ? colors.primary : colors.border, backgroundColor: tweak.id === selectedConfigId ? colors.accent : colors.secondary }]}>
              <Pressable testID={'select-custom-tweak-' + tweak.id} style={styles.itemCopy} onPress={() => selectConfig(tweak.id)}>
                <Text style={[styles.itemName, { color: colors.foreground }]}>{tweak.name}</Text>
                <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>{tweak.connectionType} • {tweak.host || 'no host'}</Text>
              </Pressable>
              <Pressable testID={'edit-custom-tweak-' + tweak.id} onPress={() => fill(tweak)} hitSlop={8}><Ionicons name="create-outline" size={18} color={colors.primary} /></Pressable>
              <Pressable onPress={() => duplicateTweak(tweak.id)} hitSlop={8}><Ionicons name="copy-outline" size={18} color={colors.mutedForeground} /></Pressable>
              <Pressable onPress={() => { void runTest(tweak); }} hitSlop={8}><Ionicons name="flash-outline" size={18} color={colors.mutedForeground} /></Pressable>
              <Pressable testID={'delete-custom-tweak-' + tweak.id} onPress={() => confirmDelete(tweak)} hitSlop={8}><Ionicons name="trash-outline" size={18} color={colors.destructive} /></Pressable>
            </View>
          ))}
        </Surface>

        {/* Custom tweak form — existing functionality */}
        <Surface>
          <View style={styles.formHeader}>
            <Text style={[styles.section, { color: colors.foreground }]}>{editingId ? 'Edit tweak' : 'Add custom tweak'}</Text>
            {editingId ? <Pressable onPress={reset} hitSlop={8}><Text style={[styles.link, { color: colors.primary }]}>New</Text></Pressable> : null}
          </View>
          <Field value={form.name} onChangeText={(value) => setForm((current) => ({ ...current, name: value }))} placeholder="Name" />
          <FieldLabel>Tunnel</FieldLabel>
          <View style={styles.radios}>{TUNNELS.map((tunnel) => <RadioOption key={tunnel} label={tunnel} selected={form.tunnel === tunnel} onPress={() => setForm((current) => ({ ...current, tunnel }))} />)}</View>
          <SelectRow label="Type" value={form.connectionType} options={TYPES} onChange={(value) => setForm((current) => ({ ...current, connectionType: value as Tweak['connectionType'] }))} />
          <FieldLabel>Template</FieldLabel>
          <ChipRow options={[...TEMPLATES]} value={form.template} onChange={(value) => applyTemplate(value as typeof TEMPLATES[number])} />
          <Field value={form.payloadConfiguration} onChangeText={(value) => setForm((current) => ({ ...current, payloadConfiguration: value }))} placeholder="Payload" multiline />
          <Field value={form.sni} onChangeText={(value) => setForm((current) => ({ ...current, sni: value }))} placeholder="SNI" />
          <SelectRow label="TLS Version" value={form.tlsVersion} options={TLS_VERSIONS} onChange={(value) => setForm((current) => ({ ...current, tlsVersion: value }))} />
          <Field value={form.host} onChangeText={(value) => setForm((current) => ({ ...current, host: value }))} placeholder="Host" />
          <Field value={form.port} onChangeText={(value) => setForm((current) => ({ ...current, port: value.replace(/[^0-9]/g, '') }))} placeholder="Port" keyboardType="number-pad" />
          <Field value={form.proxyHost ? form.proxyHost + ':' + form.proxyPort : ''} onChangeText={(value) => { const [proxyHost, proxyPort = ''] = value.split(':'); setForm((current) => ({ ...current, proxyHost, proxyPort: proxyPort.replace(/[^0-9]/g, '') })); }} placeholder="Proxy host:port" />
          <Field value={form.category} onChangeText={(value) => setForm((current) => ({ ...current, category: value }))} placeholder="Category" />
          <Field value={form.note} onChangeText={(value) => setForm((current) => ({ ...current, note: value }))} placeholder="Note" />
          <PrimaryButton title={editingId ? 'UPDATE TWEAK' : 'SAVE TWEAK'} icon="checkmark" onPress={save} />
        </Surface>
      </ScrollView>

      {/* FAB — scroll to top */}
      <Pressable onPress={scrollToTop} style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
        <Ionicons name="arrow-up" size={22} color="#000" />
      </Pressable>

      {/* 3-dot menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={[styles.menuSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Pressable testID="update-config-menu" onPress={runUpdate} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
              <Ionicons name="cloud-download-outline" size={19} color={colors.primary} />
              <Text style={[styles.menuItemText, { color: colors.foreground }]}>Update Config</Text>
            </Pressable>
            <Pressable onPress={() => { setMenuOpen(false); reset(); }} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
              <Ionicons name="add-circle-outline" size={19} color={colors.primary} />
              <Text style={[styles.menuItemText, { color: colors.foreground }]}>Add Custom Tweak</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Message modal — shows JSON message after update */}
      <Modal visible={messageOpen} transparent animationType="slide" onRequestClose={() => setMessageOpen(false)}>
        <View style={styles.messageBackdrop}>
          <View style={[styles.messageSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.messageTitle, { color: colors.foreground }]}>Config Updated</Text>
            <ScrollView style={styles.messageScroll}><Text style={[styles.messageBody, { color: colors.mutedForeground }]}>{lastMessage}</Text></ScrollView>
            <PrimaryButton title="GOT IT" icon="checkmark" onPress={() => setMessageOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 8, borderBottomWidth: 0 },
  headerIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 17, marginLeft: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  searchRow: { paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  searchInput: { minHeight: 40, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontFamily: 'Inter_400Regular', fontSize: 14 },
  scrollBody: { flex: 1 },
  configList: { paddingHorizontal: 8 },
  configItem: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 12, borderBottomWidth: 1 },
  selectedBar: { position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2, backgroundColor: '#4db8ff' },
  configContent: { flex: 1, paddingLeft: 8 },
  configName: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  configSub: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 3 },
  configLabel: { fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 0.5, marginLeft: 10 },
  statusBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12, paddingHorizontal: 20 },
  statusTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  statusText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  listCard: { marginHorizontal: 16, marginTop: 16, marginBottom: 14 },
  section: { fontFamily: 'Inter_700Bold', fontSize: 14, marginBottom: 10 },
  empty: { fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 8 },
  item: { minHeight: 58, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemCopy: { flex: 1 },
  itemName: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  itemMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  radios: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  pressed: { opacity: 0.7 },
  fab: { position: 'absolute', bottom: 100, right: 20, width: 48, height: 48, borderRadius: 24, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 6 },
  menuBackdrop: { flex: 1, alignItems: 'flex-end', paddingTop: 60, paddingRight: 12, backgroundColor: 'rgba(0,0,0,0.4)' },
  menuSheet: { borderRadius: 16, borderWidth: 1, padding: 6, minWidth: 200, gap: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12 },
  menuItemText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  messageBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' },
  messageSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, padding: 22, paddingBottom: 34 },
  messageTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, marginTop: 8, marginBottom: 14 },
  messageScroll: { maxHeight: 300, marginBottom: 18 },
  messageBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
});
