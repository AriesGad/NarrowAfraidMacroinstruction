import React, { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Header, PrimaryButton, Screen, Surface } from '@/components/Primitives';
import { Field, FieldLabel, RadioOption, SelectRow, ToggleRow } from '@/components/FormFields';
import { ModalShell } from '@/components/ModalShell';
import { CustomServerConfig, CustomServerInput, Server, V2RayProfile, V2RayProfileValues, useAppState } from '@/context/AppStateContext';
import { useColors } from '@/hooks/useColors';
import { buildV2RayPreview, parseV2RayImport } from '@/services/configImport';
import { checkEndpoint } from '@/services/responseChecker';

const TUNNELS = ['OPENVPN', 'SSH', 'V2RAY', 'DNSTT', 'UDP HYSTERIA'] as const;
const V2RAY_PROFILES: V2RayProfile[] = ['V2Ray Default', 'VLESS', 'VMess', 'Shadowsocks', 'Socks', 'HTTP', 'Trojan', 'Hysteria2', 'WireGuard'];
const OPENVPN_TYPES = ['OpenVPN TCP', 'OpenVPN UDP'];
const NETWORKS = ['tcp', 'ws', 'grpc', 'h2', 'quic', 'kcp'];
const FLOWS = ['none', 'xtls-rprx-vision'];
const SECURITIES = ['none', 'tls', 'reality'];
const METHODS = ['aes-128-gcm', 'aes-256-gcm', 'chacha20-ietf-poly1305', 'none'];
const HEADER_TYPES = ['none', 'http'];

type FormState = {
  name: string;
  protocol: typeof TUNNELS[number];
  host: string;
  port: string;
  username: string;
  password: string;
  privateKey: string;
  sslPort: string;
  category: string;
  note: string;
  openvpnType: string;
  openvpnConfig: string;
  dnsttPublicKey: string;
  udpTransfer: string;
  udpAlpn: string;
  udpPortHoppingInterval: string;
  udpAllowInsecure: boolean;
  v2rayProfile: V2RayProfile;
  v2rayProfiles: Partial<Record<V2RayProfile, V2RayProfileValues>>;
};

const EMPTY: FormState = {
  name: '', protocol: 'SSH', host: '', port: '443', username: '', password: '', privateKey: '', sslPort: '443', category: 'CF', note: '',
  openvpnType: 'OpenVPN TCP', openvpnConfig: '', dnsttPublicKey: '', udpTransfer: '', udpAlpn: '', udpPortHoppingInterval: '10', udpAllowInsecure: true,
  v2rayProfile: 'V2Ray Default', v2rayProfiles: {},
};

function str(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function parseHostLine(value: string) {
  const [left, creds = ''] = value.split('@');
  const [user, ...passParts] = creds.split(':');
  const hosts = left.split(';').filter(Boolean);
  const last = hosts[hosts.length - 1] ?? '';
  const colon = last.lastIndexOf(':');
  const port = colon > 0 && /^\d+$/.test(last.slice(colon + 1)) ? last.slice(colon + 1) : '';
  const host = colon > 0 && port ? [...hosts.slice(0, -1), last.slice(0, colon)].join(';') : left;
  return { host, port, username: user, password: passParts.join(':') };
}

function profileValues(form: FormState): V2RayProfileValues {
  return form.v2rayProfiles[form.v2rayProfile] ?? { address: form.host, port: Number(form.port) || 443 };
}

function setProfile(form: FormState, patch: V2RayProfileValues): FormState {
  const current = profileValues(form);
  const next = { ...current, ...patch };
  return { ...form, host: str(next.address, form.host), port: String(next.port ?? form.port), v2rayProfiles: { ...form.v2rayProfiles, [form.v2rayProfile]: next } };
}

function fromServer(server: Server): FormState {
  const config = server.config ?? {};
    const protocol = (TUNNELS as readonly string[]).includes(server.protocol) ? server.protocol as FormState['protocol'] : 'SSH';
  return {
    ...EMPTY,
    name: server.name,
    protocol,
    host: server.host,
    port: String(server.port || 443),
    sslPort: String(server.port || 443),
    category: server.category ?? 'CF',
    note: server.note ?? '',
    openvpnType: config.openvpnType ?? 'OpenVPN TCP',
    openvpnConfig: config.openvpnConfig ?? '',
    dnsttPublicKey: config.dnsttPublicKey ?? '',
    udpTransfer: config.udpTransfer ?? '',
    udpAlpn: config.udpAlpn ?? '',
    udpPortHoppingInterval: String(config.udpPortHoppingInterval ?? 10),
    udpAllowInsecure: config.udpAllowInsecure ?? true,
    v2rayProfile: config.v2rayProfile ?? 'V2Ray Default',
    v2rayProfiles: config.v2rayProfiles ?? {},
  };
}

export default function AddServerScreen() {
  const colors = useColors();
  const { customServers, selectedServerId, selectServer, addCustomServer, editCustomServer, deleteCustomServer } = useAppState();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const profile = profileValues(form);
  const custom = useMemo(() => customServers.filter((server) => (server.name + ' ' + server.protocol + ' ' + server.host).toLowerCase().includes(query.trim().toLowerCase())), [customServers, query]);

  const fill = (server: Server) => {
    setEditingId(server.isCustom ? server.id : null);
    setForm(fromServer(server));
  };

  const reset = () => {
    setEditingId(null);
    setForm(EMPTY);
  };

  const pasteImport = async (field: 'privateKey' | 'openvpnConfig' | 'v2ray') => {
    const text = (await Clipboard.getStringAsync()).trim();
    if (!text) {
      Alert.alert('Nothing to import', 'Copy a key or config to the clipboard first.');
      return;
    }
    if (field === 'v2ray') {
      const imported = parseV2RayImport(text);
      if (!imported) {
        Alert.alert('Unsupported config', 'Copy a vless://, vmess://, trojan://, ss://, socks://, http://, or hy2:// link.');
        return;
      }
      setForm((current) => ({ ...current, protocol: 'V2RAY', v2rayProfile: imported.profile, v2rayProfiles: { ...current.v2rayProfiles, [imported.profile]: imported.values }, host: String(imported.values.address ?? current.host), port: String(imported.values.port ?? current.port) }));
      Alert.alert('Imported ' + imported.profile, 'Fields were filled from the clipboard config.');
      return;
    }
    setForm((current) => ({ ...current, [field]: text }));
  };

  const buildInput = (): { input: CustomServerInput; username: string; password: string; privateKey: string } | null => {
    if (!form.name.trim()) {
      Alert.alert('Name required', 'Enter a server name before saving.');
      return null;
    }
    const parsed = form.protocol === 'SSH' || form.protocol === 'DNSTT' || form.protocol === 'UDP HYSTERIA' ? parseHostLine(form.host) : { host: form.host.trim(), port: form.port, username: form.username, password: form.password };
    const host = form.protocol === 'V2RAY' ? str(profile.address, form.host).trim() : parsed.host.trim();
    const port = Number(form.protocol === 'V2RAY' ? profile.port : (parsed.port || form.sslPort || form.port)) || 0;
    if (form.protocol !== 'OPENVPN' && !host) {
      Alert.alert('Host required', 'Enter a host or address for this tunnel type.');
      return null;
    }
    if (form.protocol === 'OPENVPN' && !form.openvpnConfig.trim() && !host) {
      Alert.alert('OpenVPN config required', 'Paste or import an .ovpn config, or enter a host.');
      return null;
    }
    if (form.protocol === 'V2RAY' && (form.v2rayProfile === 'VLESS' || form.v2rayProfile === 'VMess' || form.v2rayProfile === 'V2Ray Default') && !str(profile.uuid)) {
      Alert.alert('UUID required', 'Enter a UUID for this V2Ray profile.');
      return null;
    }
    const config: CustomServerConfig = {
      openvpnType: form.openvpnType,
      openvpnConfig: form.openvpnConfig,
      dnsttPublicKey: form.dnsttPublicKey,
      udpTransfer: form.udpTransfer,
      udpAlpn: form.udpAlpn,
      udpPortHoppingInterval: Number(form.udpPortHoppingInterval) || 10,
      udpAllowInsecure: form.udpAllowInsecure,
      v2rayProfile: form.v2rayProfile,
      v2rayProfiles: form.v2rayProfiles,
      v2rayHost: str(profile.address, host),
      v2rayPort: num(profile.port, port),
      v2rayUuid: str(profile.uuid),
      v2rayFlow: str(profile.flow, 'none'),
      v2rayNetwork: str(profile.network, 'tcp'),
      v2rayHeaderType: str(profile.headerType, 'none'),
      v2rayMux: bool(profile.mux),
      v2raySecurity: str(profile.security, 'none'),
    };
    return {
      input: { name: form.name.trim(), country: 'Custom', flag: 'CUS', host: host || 'openvpn', port, protocol: form.protocol, provider: 'Custom server', source: 'Saved on this device.', category: form.category.trim() || 'CF', note: form.note.trim(), config },
      username: parsed.username || form.username,
      password: parsed.password || form.password,
      privateKey: form.privateKey,
    };
  };

  const save = async () => {
    const built = buildInput();
    if (!built) return;
    if (editingId) await editCustomServer(editingId, built.input, built.username, built.password, built.privateKey);
    else await addCustomServer(built.input, built.username, built.password, built.privateKey);
    Alert.alert(editingId ? 'Server updated' : 'Server saved', built.input.name + ' is ready to select on Home.');
    reset();
  };

  const runTest = async (server: Server) => {
    if (!server.host || server.host === 'openvpn') {
      Alert.alert('Nothing to test', 'This server has no host to check yet.');
      return;
    }
    try {
      const result = await checkEndpoint({ host: server.host, port: String(server.port || ''), sni: '', proxyHost: '', proxyPort: '', customHeaders: '', method: 'HEAD' });
      Alert.alert(result.reachable ? 'Host reachable' : 'Host unreachable', server.name + ' • ' + (result.statusCode ? 'HTTP ' + result.statusCode : result.error ?? 'No HTTP response') + (result.responseTime !== null ? ' • ' + result.responseTime + ' ms' : ''));
    } catch (error) {
      Alert.alert('Test failed', error instanceof Error ? error.message : 'The host could not be checked.');
    }
  };

  const confirmDelete = (server: Server) => {
    Alert.alert('Delete server', 'Remove ' + server.name + ' from this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { void deleteCustomServer(server.id); if (editingId === server.id) reset(); } },
    ]);
  };

  return <Screen>
    <Header eyebrow="Custom" title="Add Server" action={editingId ? 'New' : undefined} onAction={editingId ? reset : undefined} />
    <View style={styles.actions}><Pressable testID="save-server" onPress={() => { void save(); }} style={({ pressed }) => [styles.save, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Text style={[styles.saveText, { color: colors.primaryForeground }]}>{editingId ? 'Update' : 'Save'}</Text></Pressable></View>

    <Surface style={styles.listCard}>
      <Field value={query} onChangeText={setQuery} placeholder="Search saved servers" />
      <Text style={[styles.section, { color: colors.foreground }]}>Saved custom servers</Text>
      {custom.length === 0 ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>No custom servers yet.</Text> : custom.map((server) => <View key={server.id} testID={'custom-server-' + server.id} style={[styles.item, { borderColor: server.id === selectedServerId ? colors.primary : colors.border, backgroundColor: server.id === selectedServerId ? colors.accent : colors.secondary }]}>
        <Pressable testID={'select-custom-server-' + server.id} style={styles.itemCopy} onPress={() => selectServer(server.id)}><Text style={[styles.itemName, { color: colors.foreground }]}>{server.name}</Text><Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>{server.protocol} • {server.host || 'no host'}</Text></Pressable>
        <Pressable testID={'edit-custom-server-' + server.id} onPress={() => fill(server)} hitSlop={8}><Ionicons name="create-outline" size={18} color={colors.primary} /></Pressable>
        <Pressable onPress={() => { void runTest(server); }} hitSlop={8}><Ionicons name="flash-outline" size={18} color={colors.mutedForeground} /></Pressable>
        <Pressable testID={'delete-custom-server-' + server.id} onPress={() => confirmDelete(server)} hitSlop={8}><Ionicons name="trash-outline" size={18} color={colors.destructive} /></Pressable>
      </View>)}
    </Surface>

    <Surface>
      <Field value={form.name} onChangeText={(value) => setForm((current) => ({ ...current, name: value }))} placeholder="Name" />
      <FieldLabel>Tunnel</FieldLabel>
      <View style={styles.radios}>{TUNNELS.map((tunnel) => <RadioOption key={tunnel} label={tunnel} selected={form.protocol === tunnel} onPress={() => setForm((current) => ({ ...current, protocol: tunnel }))} />)}</View>

      {form.protocol === 'OPENVPN' ? <>
        <SelectRow label="Type" value={form.openvpnType} options={OPENVPN_TYPES} onChange={(value) => setForm((current) => ({ ...current, openvpnType: value }))} />
        <Field value={form.username && form.password ? form.username + ':' + form.password : form.username} onChangeText={(value) => { const [username, ...rest] = value.split(':'); setForm((current) => ({ ...current, username, password: rest.join(':') })); }} placeholder="user:pass" />
        <View style={styles.rowBetween}><FieldLabel>OpenVPN Config</FieldLabel><Pressable onPress={() => { void pasteImport('openvpnConfig'); }}><Text style={[styles.link, { color: colors.primary }]}>Import .ovpn</Text></Pressable></View>
        <Field value={form.openvpnConfig} onChangeText={(value) => setForm((current) => ({ ...current, openvpnConfig: value }))} placeholder="OpenVPN Config" multiline />
        <Field value={form.sslPort} onChangeText={(value) => setForm((current) => ({ ...current, sslPort: value.replace(/[^0-9]/g, ''), port: value.replace(/[^0-9]/g, '') }))} placeholder="SSL Port (Default: 443)" keyboardType="number-pad" />
        <Field value={form.privateKey} onChangeText={(value) => setForm((current) => ({ ...current, privateKey: value }))} placeholder="Private key (optional)" multiline />
      </> : null}

      {form.protocol === 'SSH' ? <>
        <Field value={form.host} onChangeText={(value) => setForm((current) => ({ ...current, host: value }))} placeholder="host1;host2;host3:port@user:pass" />
        <Field value={form.sslPort} onChangeText={(value) => setForm((current) => ({ ...current, sslPort: value.replace(/[^0-9]/g, ''), port: value.replace(/[^0-9]/g, '') }))} placeholder="SSL Port (Default: 443)" keyboardType="number-pad" />
        <View style={styles.rowBetween}><FieldLabel>Private Key (optional)</FieldLabel><Pressable onPress={() => { void pasteImport('privateKey'); }}><Text style={[styles.link, { color: colors.primary }]}>Import Key</Text></Pressable></View>
        <Field value={form.privateKey} onChangeText={(value) => setForm((current) => ({ ...current, privateKey: value }))} placeholder="Private Key (optional)" multiline />
      </> : null}

      {form.protocol === 'V2RAY' ? <V2RayFields form={form} profile={profile} setForm={setForm} onImport={() => { void pasteImport('v2ray'); }} onPreview={() => setPreviewOpen(true)} /> : null}

      {form.protocol === 'DNSTT' ? <>
        <Field value={form.host} onChangeText={(value) => setForm((current) => ({ ...current, host: value }))} placeholder="ns1;ns2;ns3@user:pass" />
        <Field value={form.dnsttPublicKey} onChangeText={(value) => setForm((current) => ({ ...current, dnsttPublicKey: value }))} placeholder="Public Key" />
      </> : null}

      {form.protocol === 'UDP HYSTERIA' ? <>
        <Field value={form.host} onChangeText={(value) => setForm((current) => ({ ...current, host: value }))} placeholder="host1;host2:port@auth[:obfs]" />
        <Field value={form.udpTransfer} onChangeText={(value) => setForm((current) => ({ ...current, udpTransfer: value }))} placeholder="Upload:Download (Mbps)" />
        <Field value={form.udpAlpn} onChangeText={(value) => setForm((current) => ({ ...current, udpAlpn: value }))} placeholder="ALPN" />
        <Field value={form.udpPortHoppingInterval} onChangeText={(value) => setForm((current) => ({ ...current, udpPortHoppingInterval: value.replace(/[^0-9]/g, '') }))} placeholder="Port Hopping Interval (seconds)" keyboardType="number-pad" />
        <ToggleRow label="Allow Insecure" value={form.udpAllowInsecure} onChange={(value) => setForm((current) => ({ ...current, udpAllowInsecure: value }))} />
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>Using hysteria2:// or hy2://? Go to V2Ray and choose Hysteria2.</Text>
      </> : null}

      <Field value={form.category} onChangeText={(value) => setForm((current) => ({ ...current, category: value }))} placeholder="Category" />
      <Field value={form.note} onChangeText={(value) => setForm((current) => ({ ...current, note: value }))} placeholder="Note" />
      <PrimaryButton title={editingId ? 'UPDATE SERVER' : 'SAVE SERVER'} icon="checkmark" onPress={() => { void save(); }} />
    </Surface>
    <ModalShell visible={previewOpen} title="Generated config" subtitle="Preview of the selected V2Ray profile. This is stored locally and is not sent to a VPN engine yet." onClose={() => setPreviewOpen(false)}>
      <ScrollView style={styles.previewScroll}><Text style={[styles.preview, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]}>{buildV2RayPreview(form.v2rayProfile, profile)}</Text></ScrollView>
      <PrimaryButton title="COPY PREVIEW" icon="copy-outline" onPress={() => { void Clipboard.setStringAsync(buildV2RayPreview(form.v2rayProfile, profile)); Alert.alert('Copied', 'The generated config was copied to the clipboard.'); }} />
      <View style={{ height: 8 }} />
      <PrimaryButton title="CLOSE" icon="close" secondary onPress={() => setPreviewOpen(false)} />
    </ModalShell>
  </Screen>;
}

function V2RayFields({ form, profile, setForm, onImport, onPreview }: { form: FormState; profile: V2RayProfileValues; setForm: React.Dispatch<React.SetStateAction<FormState>>; onImport: () => void; onPreview: () => void }) {
  const colors = useColors();
  const patch = (next: V2RayProfileValues) => setForm((current) => setProfile(current, next));
  const network = str(profile.network, 'tcp');
  const security = str(profile.security, 'none');
  return <>
    <SelectRow label="V2Ray Profile" value={form.v2rayProfile} options={V2RAY_PROFILES} onChange={(value) => setForm((current) => ({ ...current, v2rayProfile: value as V2RayProfile }))} />
    <View style={styles.rowBetween}><FieldLabel>Server</FieldLabel><View style={styles.rowBetween}><Pressable onPress={onImport}><Text style={[styles.link, { color: colors.primary }]}>Import Config</Text></Pressable><Pressable onPress={onPreview}><Text style={[styles.link, { color: colors.primary, marginLeft: 12 }]}>{'</>'}</Text></Pressable></View></View>
    <View style={styles.split}><View style={{ flex: 1 }}><Field value={str(profile.address)} onChangeText={(value) => patch({ address: value })} placeholder="Address/Host" /></View><View style={{ width: 110 }}><Field value={String(profile.port ?? '')} onChangeText={(value) => patch({ port: value.replace(/[^0-9]/g, '') })} placeholder="Port" keyboardType="number-pad" /></View></View>
    {form.v2rayProfile === 'Shadowsocks' ? <>
      <SelectRow label="Method" value={str(profile.method, METHODS[0])} options={METHODS} onChange={(value) => patch({ method: value })} />
      <Field value={str(profile.password)} onChangeText={(value) => patch({ password: value })} placeholder="Password" secure />
    </> : null}
    {form.v2rayProfile === 'Socks' || form.v2rayProfile === 'HTTP' ? <>
      <Field value={str(profile.username)} onChangeText={(value) => patch({ username: value })} placeholder="Username" />
      <Field value={str(profile.password)} onChangeText={(value) => patch({ password: value })} placeholder="Password" secure />
    </> : null}
    {form.v2rayProfile === 'Trojan' || form.v2rayProfile === 'Hysteria2' ? <Field value={str(profile.password)} onChangeText={(value) => patch({ password: value })} placeholder="Password / Authentication" secure /> : null}
    {form.v2rayProfile === 'WireGuard' ? <>
      <Field value={str(profile.privateKey)} onChangeText={(value) => patch({ privateKey: value })} placeholder="Private Key" multiline />
      <Field value={str(profile.publicKey)} onChangeText={(value) => patch({ publicKey: value })} placeholder="Public Key" />
      <Field value={str(profile.clientAddress)} onChangeText={(value) => patch({ clientAddress: value })} placeholder="Client Address" />
      <Field value={str(profile.dns)} onChangeText={(value) => patch({ dns: value })} placeholder="DNS" />
      <Field value={str(profile.mtu)} onChangeText={(value) => patch({ mtu: value })} placeholder="MTU" />
      <Field value={str(profile.allowedIps)} onChangeText={(value) => patch({ allowedIps: value })} placeholder="Allowed IPs" />
    </> : null}
    {form.v2rayProfile === 'V2Ray Default' || form.v2rayProfile === 'VLESS' || form.v2rayProfile === 'VMess' ? <>
      <Field value={str(profile.uuid)} onChangeText={(value) => patch({ uuid: value })} placeholder="UUID" />
      {form.v2rayProfile === 'VLESS' ? <Field value={str(profile.encryption, 'none')} onChangeText={(value) => patch({ encryption: value })} placeholder="Encryption" /> : null}
      {form.v2rayProfile === 'VMess' ? <Field value={str(profile.alterId, '0')} onChangeText={(value) => patch({ alterId: value.replace(/[^0-9]/g, '') })} placeholder="Alter ID" keyboardType="number-pad" /> : null}
      {form.v2rayProfile !== 'VMess' ? <SelectRow label="Flow" value={str(profile.flow, 'none')} options={FLOWS} onChange={(value) => patch({ flow: value })} /> : null}
      <SelectRow label="Network" value={network} options={NETWORKS} onChange={(value) => patch({ network: value })} />
      <SelectRow label="Header Type" value={str(profile.headerType, 'none')} options={HEADER_TYPES} onChange={(value) => patch({ headerType: value })} />
      <ToggleRow label="Mux" value={bool(profile.mux)} onChange={(value) => patch({ mux: value })} />
      <SelectRow label="Security" value={security} options={SECURITIES} onChange={(value) => patch({ security: value })} />
    </> : null}
    {(form.v2rayProfile === 'Trojan' || form.v2rayProfile === 'Hysteria2' || security === 'tls' || security === 'reality') && form.v2rayProfile !== 'WireGuard' && form.v2rayProfile !== 'Socks' ? <>
      <Field value={str(profile.sni)} onChangeText={(value) => patch({ sni: value })} placeholder="SNI / Server Name" />
      {security === 'reality' || form.v2rayProfile === 'VLESS' ? <>
        <Field value={str(profile.fingerprint)} onChangeText={(value) => patch({ fingerprint: value })} placeholder="Fingerprint" />
        <Field value={str(profile.publicKey)} onChangeText={(value) => patch({ publicKey: value })} placeholder="Public Key" />
        <Field value={str(profile.shortId)} onChangeText={(value) => patch({ shortId: value })} placeholder="Short ID" />
        <Field value={str(profile.spiderX)} onChangeText={(value) => patch({ spiderX: value })} placeholder="SpiderX" />
      </> : null}
    </> : null}
    {(network === 'ws' || network === 'h2' || form.v2rayProfile === 'Trojan') && form.v2rayProfile !== 'WireGuard' ? <>
      <Field value={str(profile.host)} onChangeText={(value) => patch({ host: value })} placeholder="Host" />
      <Field value={str(profile.path)} onChangeText={(value) => patch({ path: value })} placeholder="Path" />
    </> : null}
    {network === 'grpc' ? <Field value={str(profile.serviceName)} onChangeText={(value) => patch({ serviceName: value })} placeholder="Service Name" /> : null}
    {form.v2rayProfile === 'Hysteria2' ? <>
      <Field value={str(profile.obfuscation)} onChangeText={(value) => patch({ obfuscation: value })} placeholder="Obfuscation" />
      <Field value={str(profile.alpn)} onChangeText={(value) => patch({ alpn: value })} placeholder="ALPN" />
    </> : null}
  </>;
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginBottom: 14 },
  save: { minHeight: 36, borderRadius: 18, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  listCard: { marginBottom: 14 },
  section: { fontFamily: 'Inter_700Bold', fontSize: 14, marginBottom: 10 },
  empty: { fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 8 },
  item: { minHeight: 58, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemCopy: { flex: 1 },
  itemName: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  itemMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 },
  radios: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 11, marginBottom: 8 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginBottom: 10 },
  split: { flexDirection: 'row', gap: 8 },
  previewScroll: { maxHeight: 280, marginVertical: 14 },
  preview: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, borderWidth: 1, borderRadius: 12, padding: 12 },
  pressed: { opacity: 0.7 },
});
