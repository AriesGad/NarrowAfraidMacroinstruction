import React, { useCallback, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Header, Label, Pill, PrimaryButton, Row, Screen, Surface } from '@/components/Primitives';
import { ModalShell } from '@/components/ModalShell';
import { CustomServerConfig, CustomServerInput, Server, useAppState } from '@/context/AppStateContext';
import { useColors } from '@/hooks/useColors';
import { useFocusEffect } from 'expo-router';

const TUNNELS = ['OPENVPN', 'SSH', 'V2RAY', 'DNSTT', 'UDP HYSTERIA'] as const;
type Tunnel = typeof TUNNELS[number];

const DEFAULT_CONFIG: CustomServerConfig = {
  openvpnType: 'OpenVPN TCP',
  udpPortHoppingInterval: 10,
  udpAllowInsecure: false,
  v2rayProfile: 'V2Ray Default',
  v2rayFlow: 'none',
  v2rayNetwork: 'tcp',
  v2rayHeaderType: 'none',
  v2rayMux: false,
  v2raySecurity: 'none',
};

const EMPTY_FORM: CustomServerInput = {
  name: '',
  country: '',
  flag: 'CU',
  host: '',
  port: 443,
  protocol: 'SSH',
  provider: 'My authorized server',
  source: 'User-provided configuration',
  category: 'CF',
  note: '',
  config: DEFAULT_CONFIG,
};

const inputPlaceholder = {
  ssh: 'host1;host2;host3:port@user:pass',
  dnstt: 'ns1;ns2;ns3@user:pass',
  hysteria: 'host1;host2:port@auth:obfs',
};

type Colors = ReturnType<typeof useColors>;

function SelectRow({ label, value, options, colors, onChange }: { label: string; value: string; options: string[]; colors: Colors; onChange: (value: string) => void }) {
  const choose = () => Alert.alert(label, 'Choose a value', [...options.map((option) => ({ text: option, onPress: () => onChange(option) })), { text: 'Cancel', style: 'cancel' }]);
  return <Pressable onPress={choose} style={styles.selectRow}><Text style={[styles.selectLabel, { color: colors.foreground }]}>{label}</Text><Text style={[styles.selectValue, { color: colors.foreground }]}>{value}</Text><Ionicons name="chevron-down" size={17} color={colors.mutedForeground} /></Pressable>;
}

export default function ServersScreen() {
  const colors = useColors();
  const { servers, selectedServerId, selectServer, addCustomServer, editCustomServer, deleteCustomServer, testServer } = useAppState();
  const [refreshing, setRefreshing] = useState(false);
  const [editorOpen, setEditorOpen] = useState(true);
  const [detailServer, setDetailServer] = useState<Server | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomServerInput>(EMPTY_FORM);
  const [sshUsername, setSshUsername] = useState('');
  const [sshPassword, setSshPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const customServers = useMemo(() => servers.filter((server) => server.isCustom), [servers]);
  const protocol = form.protocol as Tunnel;

  useFocusEffect(useCallback(() => {
    setEditorOpen(true);
    return undefined;
  }, []));

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 650);
  };

  const update = (key: keyof CustomServerInput, value: string) => setForm((current) => ({
    ...current,
    [key]: key === 'port' ? Number(value.replace(/[^0-9]/g, '')) || 0 : value,
  }));

  const updateConfig = <K extends keyof CustomServerConfig>(key: K, value: CustomServerConfig[K]) => setForm((current) => ({
    ...current,
    config: { ...current.config, [key]: value },
  }));

  const changeProtocol = (nextProtocol: Tunnel) => {
    setForm((current) => ({
      ...current,
      protocol: nextProtocol,
      host: nextProtocol === 'V2RAY' ? (current.config.v2rayHost ?? '') : current.host,
      port: nextProtocol === 'V2RAY' ? (current.config.v2rayPort ?? 443) : current.port,
    }));
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, config: { ...DEFAULT_CONFIG } });
    setSshUsername('');
    setSshPassword('');
    setPrivateKey('');
    setEditorOpen(true);
  };

  const openEdit = (server: Server) => {
    const config = { ...DEFAULT_CONFIG, ...(server.config ?? {}) };
    setEditingId(server.id);
    setForm({
      name: server.name,
      country: server.country,
      flag: server.flag,
      host: server.protocol === 'V2RAY' ? (config.v2rayHost ?? server.host) : server.host,
      port: server.protocol === 'V2RAY' ? (config.v2rayPort ?? server.port) : server.port,
      protocol: server.protocol,
      provider: server.provider,
      source: server.source,
      category: server.category ?? 'CF',
      note: server.note ?? '',
      config,
    });
    setSshUsername('');
    setSshPassword('');
    setPrivateKey('');
    setEditorOpen(true);
  };

  const save = async () => {
    const endpoint = protocol === 'V2RAY' ? form.config.v2rayHost?.trim() : form.host.trim();
    if (!form.name.trim() || !endpoint || !form.port) {
      Alert.alert('Missing server details', 'Add a name, server address, and port before saving.');
      return;
    }
    const input = protocol === 'V2RAY'
      ? { ...form, host: form.config.v2rayHost ?? form.host, port: form.config.v2rayPort ?? form.port }
      : form;
    if (editingId) await editCustomServer(editingId, input, sshUsername, sshPassword, privateKey);
    else await addCustomServer(input, sshUsername, sshPassword, privateKey);
    setEditorOpen(false);
  };

  const remove = async (server: Server) => {
    await deleteCustomServer(server.id);
    setDetailServer(null);
  };

  const textInput = (testID: string, value: string, placeholder: string, onChangeText: (value: string) => void, extraStyle?: object) => (
    <TextInput
      testID={testID}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary }, extraStyle]}
    />
  );

  const renderTunnelFields = () => {
    if (protocol === 'OPENVPN') {
      return <View style={styles.tunnelFields}>
        <SelectRow label="Type:" value={form.config.openvpnType ?? 'OpenVPN TCP'} options={['OpenVPN TCP', 'OpenVPN UDP']} colors={colors} onChange={(value) => updateConfig('openvpnType', value)} />
        {textInput('openvpn-credentials', form.host, 'user:pass', (value) => update('host', value))}
        <View style={styles.configLabelRow}><Text style={[styles.configLabel, { color: colors.foreground }]}>OpenVPN Config</Text><Pressable style={styles.importChip} onPress={() => Alert.alert('Import .ovpn', 'File importing will be connected when the authorized VPN backend is added.')}><Ionicons name="folder-open-outline" size={14} color={colors.foreground} /><Text style={[styles.importText, { color: colors.foreground }]}>Import .ovpn</Text></Pressable></View>
        {textInput('openvpn-config', form.config.openvpnConfig ?? '', 'Paste OpenVPN configuration', (value) => updateConfig('openvpnConfig', value), styles.largeInput)}
        {textInput('server-port', String(form.port || ''), 'SSL Port (Default: 443)', (value) => update('port', value))}
        {textInput('server-private-key', privateKey, 'Private key (optional)', setPrivateKey, styles.largeInput)}
      </View>;
    }

    if (protocol === 'V2RAY') {
      return <View style={styles.tunnelFields}>
        <Text style={[styles.subsectionLabel, { color: colors.mutedForeground }]}>V2Ray Profile</Text>
        <View style={styles.profileRow}><Text style={[styles.profileValue, { color: colors.foreground }]}>{form.config.v2rayProfile ?? 'V2Ray Default'}</Text><Pressable onPress={() => Alert.alert('Profile tools', 'Profile import and export will be connected to the authorized backend later.')}><Ionicons name="clipboard-outline" size={20} color={colors.mutedForeground} /></Pressable><Pressable onPress={() => Alert.alert('Profile code', 'Profile code editing will be connected to the authorized backend later.')}><Ionicons name="code-slash-outline" size={20} color={colors.mutedForeground} /></Pressable><Ionicons name="chevron-down" size={17} color={colors.mutedForeground} /></View>
        <Text style={[styles.subsectionLabel, { color: colors.mutedForeground }]}>Server</Text>
        <View style={styles.splitRow}>{textInput('v2ray-host', form.config.v2rayHost ?? form.host, 'Address/Host', (value) => { updateConfig('v2rayHost', value); update('host', value); }, styles.splitInput)}{textInput('v2ray-port', String(form.config.v2rayPort ?? form.port), 'Port', (value) => { const port = Number(value.replace(/[^0-9]/g, '')) || 0; updateConfig('v2rayPort', port); update('port', value); }, styles.portInput)}</View>
        <Text style={[styles.subsectionLabel, { color: colors.mutedForeground }]}>VLESS settings</Text>
        {textInput('v2ray-uuid', form.config.v2rayUuid ?? '', 'UUID', (value) => updateConfig('v2rayUuid', value))}
        <SelectRow label="Flow" value={form.config.v2rayFlow ?? 'none'} options={['none', 'xtls-rprx-vision']} colors={colors} onChange={(value) => updateConfig('v2rayFlow', value)} />
        <Text style={[styles.subsectionLabel, { color: colors.mutedForeground }]}>Transport</Text>
        <SelectRow label="Network" value={form.config.v2rayNetwork ?? 'tcp'} options={['tcp', 'ws', 'grpc', 'http']} colors={colors} onChange={(value) => updateConfig('v2rayNetwork', value)} />
        <SelectRow label="Header Type" value={form.config.v2rayHeaderType ?? 'none'} options={['none', 'http']} colors={colors} onChange={(value) => updateConfig('v2rayHeaderType', value)} />
        <View style={styles.switchRow}><Text style={[styles.switchLabel, { color: colors.foreground }]}>Mux</Text><Switch value={Boolean(form.config.v2rayMux)} onValueChange={(value) => updateConfig('v2rayMux', value)} trackColor={{ false: colors.border, true: colors.mutedForeground }} thumbColor={colors.foreground} /></View>
        <Text style={[styles.subsectionLabel, { color: colors.mutedForeground }]}>Security / TLS</Text>
        <SelectRow label="Security" value={form.config.v2raySecurity ?? 'none'} options={['none', 'tls', 'reality']} colors={colors} onChange={(value) => updateConfig('v2raySecurity', value)} />
      </View>;
    }

    if (protocol === 'DNSTT') {
      return <View style={styles.tunnelFields}>
        {textInput('server-host', form.host, inputPlaceholder.dnstt, (value) => update('host', value))}
        {textInput('dnstt-public-key', form.config.dnsttPublicKey ?? '', 'Public Key', (value) => updateConfig('dnsttPublicKey', value))}
      </View>;
    }

    if (protocol === 'UDP HYSTERIA') {
      return <View style={styles.tunnelFields}>
        {textInput('server-host', form.host, inputPlaceholder.hysteria, (value) => update('host', value))}
        {textInput('udp-transfer', form.config.udpTransfer ?? '', 'Upload:Download (Mbps)', (value) => updateConfig('udpTransfer', value))}
        {textInput('udp-alpn', form.config.udpAlpn ?? '', 'ALPN', (value) => updateConfig('udpAlpn', value))}
        {textInput('udp-port-hopping', String(form.config.udpPortHoppingInterval ?? 10), 'Port Hopping Interval (seconds)', (value) => updateConfig('udpPortHoppingInterval', Number(value.replace(/[^0-9]/g, '')) || 0))}
        <View style={styles.switchRow}><Text style={[styles.switchLabel, { color: colors.foreground }]}>Allow Insecure</Text><Switch value={Boolean(form.config.udpAllowInsecure)} onValueChange={(value) => updateConfig('udpAllowInsecure', value)} trackColor={{ false: colors.border, true: colors.mutedForeground }} thumbColor={colors.foreground} /></View>
        <View style={styles.infoRow}><Ionicons name="information-circle" size={19} color={colors.mutedForeground} /><Text style={[styles.infoText, { color: colors.mutedForeground }]}>Using hysteria:// or hy2://? Go to V2Ray and choose Histeria2.</Text></View>
      </View>;
    }

    return <View style={styles.tunnelFields}>
      {textInput('server-host', form.host, inputPlaceholder.ssh, (value) => update('host', value))}
      {textInput('server-port', String(form.port || ''), 'SSL Port (Default: 443)', (value) => update('port', value))}
      <View style={styles.configLabelRow}><Text style={[styles.configLabel, { color: colors.foreground }]}>Private Key (optional)</Text><Pressable style={styles.importChip} onPress={() => Alert.alert('Import Key', 'Key importing will be connected when the authorized VPN backend is added.')}><Ionicons name="folder-open-outline" size={14} color={colors.foreground} /><Text style={[styles.importText, { color: colors.foreground }]}>Import Key</Text></Pressable></View>
      {textInput('server-private-key', privateKey, 'Paste private key', setPrivateKey, styles.largeInput)}
    </View>;
  };

  return <Screen>
    <Header eyebrow="Network" title="Add Server" action={editorOpen ? undefined : (refreshing ? 'SYNCING' : 'REFRESH')} onAction={refresh} />
    <Surface style={styles.summary}><View><Label>Server catalog</Label><Text style={[styles.bigNumber, { color: colors.foreground }]}>{servers.length.toString().padStart(2, '0')}</Text></View><View style={styles.summaryDivider} /><View><Label>Selected</Label><Text style={[styles.selectedText, { color: colors.primary }]}>{servers.find((server) => server.id === selectedServerId)?.name ?? 'Random / Fastest'}</Text></View></Surface>
    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Built-in Servers</Text>
    <View style={styles.list}>{servers.filter((server) => !server.isCustom).map((server) => <Pressable key={server.id} testID={'server-' + server.id} onPress={() => selectServer(server.id)} style={({ pressed }) => [styles.serverItem, { backgroundColor: server.id === selectedServerId ? colors.accent : colors.card, borderColor: server.id === selectedServerId ? colors.primary : colors.border }, pressed && styles.pressed]}><View style={[styles.serverIcon, { backgroundColor: colors.secondary }]}><Text style={[styles.flagText, { color: server.id === selectedServerId ? colors.primary : colors.mutedForeground }]}>{server.flag}</Text></View><View style={{ flex: 1 }}><Text style={[styles.serverName, { color: colors.foreground }]}>{server.name}</Text><Text style={[styles.serverLocation, { color: colors.mutedForeground }]}>{server.country}</Text></View><View style={styles.serverMeta}>{server.enabled && server.latency ? <Pill tone="green">{server.latency + ' ms'}</Pill> : <Pill tone="amber">{server.id === 'random-fastest' ? 'AUTO' : 'SETUP'}</Pill>}{server.id === selectedServerId ? <Ionicons name="checkmark-circle" size={19} color={colors.primary} /> : null}</View><Pressable hitSlop={10} onPress={(event) => { event.stopPropagation(); setDetailServer(server); }}><Ionicons name="information-circle-outline" size={20} color={colors.mutedForeground} /></Pressable></Pressable>)}</View>
    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Custom Servers</Text>
    <View style={styles.list}>{customServers.map((server) => <Pressable key={server.id} onPress={() => selectServer(server.id)} style={({ pressed }) => [styles.serverItem, { backgroundColor: server.id === selectedServerId ? colors.accent : colors.card, borderColor: server.id === selectedServerId ? colors.primary : colors.border }, pressed && styles.pressed]}><View style={[styles.serverIcon, { backgroundColor: colors.secondary }]}><Ionicons name="construct-outline" size={18} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={[styles.serverName, { color: colors.foreground }]}>{server.name}</Text><Text style={[styles.serverLocation, { color: colors.mutedForeground }]}>{server.host}:{server.port} • {server.hasCredentials ? 'Credentials secured' : 'No credentials saved'}</Text></View><Pressable hitSlop={10} onPress={() => openEdit(server)}><Ionicons name="create-outline" size={19} color={colors.mutedForeground} /></Pressable></Pressable>)}</View>
    <Surface style={styles.customCard}><Row icon="add-circle-outline" title="+ CUSTOM SERVER" subtitle="Create a profile for a server you own or are authorized to use" right={<Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />} onPress={openNew} /><Text style={[styles.helper, { color: colors.mutedForeground }]}>SSH usernames, passwords, and private keys are kept in Android secure storage. They never appear in the normal app state or VPN logs.</Text></Surface>
    <ModalShell visible={editorOpen} title={editingId ? 'Edit Server' : 'Add Server'} subtitle="Only save a server configuration that you own or are authorized to use." onClose={() => setEditorOpen(false)}>
      <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <View style={styles.formToolbar}><Text style={[styles.formHint, { color: colors.mutedForeground }]}>Server profile</Text><Pressable testID="save-server-top" onPress={() => { void save(); }} style={({ pressed }) => [styles.topSave, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Text style={[styles.topSaveText, { color: colors.primaryForeground }]}>SAVE</Text></Pressable></View>
        {textInput('server-name', form.name, 'Name', (value) => update('name', value))}
        <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Tunnel</Text>
        <View style={styles.tunnelGrid}>{TUNNELS.map((tunnel) => <Pressable key={tunnel} onPress={() => changeProtocol(tunnel)} style={styles.tunnelChoice}><View style={[styles.radio, { borderColor: protocol === tunnel ? colors.primary : colors.mutedForeground }]}>{protocol === tunnel ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}</View><Text style={[styles.tunnelText, { color: colors.foreground }]}>{tunnel}</Text></Pressable>)}</View>
        {renderTunnelFields()}
        {textInput('server-category', form.category, 'Category', (value) => update('category', value))}
        {textInput('server-note', form.note, 'Note', (value) => update('note', value))}
        <Text style={[styles.securityNote, { color: colors.mutedForeground }]}>Private keys and SSH credentials are stored with secure device storage and never written to ordinary app data or VPN logs.</Text>
        <View style={styles.modalActions}><PrimaryButton title="TEST" icon="pulse" secondary onPress={() => { if (editingId) testServer(editingId); else Alert.alert('Save first', 'Save this authorized server profile before testing it.'); }} /></View>
      </ScrollView>
    </ModalShell>
    <ModalShell visible={Boolean(detailServer)} title={detailServer?.name ?? 'Server details'} subtitle="Provider and source details are shown so you can verify authorization before using an endpoint." onClose={() => setDetailServer(null)}>{detailServer ? <View style={styles.details}>{[['Country', detailServer.country], ['Protocol', detailServer.protocol], ['Provider', detailServer.provider], ['Source', detailServer.source], ['Host', detailServer.host || 'Not configured'], ['Port', String(detailServer.port || '—')]].map(([label, value]) => <View key={label} style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text><Text style={[styles.detailValue, { color: colors.foreground }]}>{value}</Text></View>)}<PrimaryButton title="TEST CONNECTION" icon="pulse" onPress={() => testServer(detailServer.id)} secondary />{detailServer.isCustom ? <PrimaryButton title="DELETE PROFILE" icon="trash-outline" onPress={() => { void remove(detailServer); }} secondary /> : null}</View> : null}</ModalShell>
  </Screen>;
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  bigNumber: { fontFamily: 'Inter_700Bold', fontSize: 30, marginTop: 8 },
  summaryDivider: { width: 1, height: 48, backgroundColor: '#29292e' },
  selectedText: { fontFamily: 'Inter_700Bold', fontSize: 14, marginTop: 8, maxWidth: 140 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, marginTop: 28, marginBottom: 12 },
  list: { gap: 10 },
  serverItem: { minHeight: 78, borderRadius: 19, borderWidth: 1, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  serverIcon: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  flagText: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.5 },
  serverName: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  serverLocation: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  serverMeta: { alignItems: 'flex-end', gap: 7 },
  customCard: { marginTop: 15 },
  helper: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, marginTop: 8, paddingLeft: 50 },
  formScroll: { maxHeight: 635 },
  formContent: { paddingBottom: 8 },
  formToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 2 },
  formHint: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  topSave: { minWidth: 72, minHeight: 36, borderRadius: 19, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  topSaveText: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.5 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 10 },
  largeInput: { minHeight: 110, textAlignVertical: 'top', paddingTop: 13 },
  fieldLabel: { fontFamily: 'Inter_700Bold', fontSize: 14, marginTop: 16, marginBottom: 8 },
  tunnelGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 13 },
  tunnelChoice: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 90 },
  radio: { width: 21, height: 21, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
  tunnelText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  tunnelFields: { marginTop: 2 },
  configLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15 },
  configLabel: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  importChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 14, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#28282f' },
  importText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  selectRow: { minHeight: 53, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  selectLabel: { fontFamily: 'Inter_500Medium', fontSize: 14, minWidth: 112 },
  selectValue: { fontFamily: 'Inter_400Regular', fontSize: 16, flex: 1 },
  subsectionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 16, marginBottom: 3 },
  profileRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 18 },
  profileValue: { fontFamily: 'Inter_400Regular', fontSize: 16, flex: 1, paddingLeft: 8 },
  splitRow: { flexDirection: 'row', gap: 10 },
  splitInput: { flex: 1 },
  portInput: { width: 120 },
  switchRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 },
  switchLabel: { fontFamily: 'Inter_400Regular', fontSize: 15 },
  infoRow: { flexDirection: 'row', gap: 7, alignItems: 'flex-start', marginTop: 4 },
  infoText: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, flex: 1 },
  securityNote: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, marginTop: 11 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  details: { gap: 11, marginTop: 15 },
  detailRow: { gap: 5 },
  detailLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 0.9, textTransform: 'uppercase' },
  detailValue: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
  pressed: { opacity: 0.75 },
});