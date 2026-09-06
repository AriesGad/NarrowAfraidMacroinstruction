import React, { useCallback, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Header, Label, Pill, PrimaryButton, Row, Screen, Surface } from '@/components/Primitives';
import { ModalShell } from '@/components/ModalShell';
import { CustomServerConfig, CustomServerInput, Server, V2RayProfile, useAppState } from '@/context/AppStateContext';
import { useColors } from '@/hooks/useColors';
import { useFocusEffect } from 'expo-router';

const TUNNELS = ['OPENVPN', 'SSH', 'V2RAY', 'DNSTT', 'UDP HYSTERIA'] as const;
type Tunnel = typeof TUNNELS[number];
const V2RAY_PROFILES: V2RayProfile[] = ['V2Ray Default', 'VLESS', 'VMess', 'Shadowsocks', 'Socks', 'HTTP', 'Trojan', 'Hysteria2', 'WireGuard'];
const V2RAY_REQUIRED_FIELDS: Record<V2RayProfile, string[]> = {
  'V2Ray Default': ['address', 'port'],
  VLESS: ['address', 'port', 'uuid'],
  VMess: ['address', 'port', 'uuid'],
  Shadowsocks: ['address', 'port', 'password'],
  Socks: ['address', 'port'],
  HTTP: ['address', 'port'],
  Trojan: ['address', 'port', 'password'],
  Hysteria2: ['address', 'port', 'password'],
  WireGuard: ['endpoint', 'port'],
};

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
  v2rayProfiles: {},
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

function importedProfile(raw: string): { profile: V2RayProfile; values: Record<string, string | number | boolean> } | null {
  const value = raw.trim();
  if (!value) return null;
  const scheme = value.split(':', 1)[0].toLowerCase();
  try {
    const parsed = new URL(value);
    const values: Record<string, string | number | boolean> = {
      address: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 443,
      password: decodeURIComponent(parsed.password || ''),
      username: decodeURIComponent(parsed.username || ''),
      sni: parsed.searchParams.get('sni') || parsed.searchParams.get('security') || '',
      network: parsed.searchParams.get('type') || parsed.searchParams.get('net') || 'tcp',
      path: parsed.searchParams.get('path') || '',
      host: parsed.searchParams.get('host') || '',
      flow: parsed.searchParams.get('flow') || 'none',
    };
    if (scheme === 'vless') return { profile: 'VLESS', values: { ...values, uuid: decodeURIComponent(parsed.username) || '' } };
    if (scheme === 'trojan') return { profile: 'Trojan', values: { ...values, password: decodeURIComponent(parsed.username || parsed.password || '') } };
    if (scheme === 'ss') return { profile: 'Shadowsocks', values: { ...values, method: decodeURIComponent(parsed.username || ''), password: decodeURIComponent(parsed.password || '') } };
    if (scheme === 'socks' || scheme === 'socks5') return { profile: 'Socks', values };
    if (scheme === 'http' || scheme === 'https') return { profile: 'HTTP', values: { ...values, tls: scheme === 'https' } };
  } catch {
    return null;
  }
  return null;
}

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
  const [profilePickerOpen, setProfilePickerOpen] = useState(false);
  const [importConfigOpen, setImportConfigOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const customServers = useMemo(() => servers.filter((server) => server.isCustom), [servers]);
  const protocol = form.protocol as Tunnel;
  const v2rayProfile = form.config.v2rayProfile ?? 'V2Ray Default';
  const profileValues = form.config.v2rayProfiles?.[v2rayProfile] ?? {
    address: form.config.v2rayHost ?? form.host,
    port: form.config.v2rayPort ?? form.port,
    uuid: form.config.v2rayUuid ?? '',
    flow: form.config.v2rayFlow ?? 'none',
    network: form.config.v2rayNetwork ?? 'tcp',
    headerType: form.config.v2rayHeaderType ?? 'none',
    mux: Boolean(form.config.v2rayMux),
    security: form.config.v2raySecurity ?? 'none',
  };

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

  const updateProfileValue = (key: string, value: string | number | boolean) => setForm((current) => {
    const profile = current.config.v2rayProfile ?? 'V2Ray Default';
    const profileMap = { ...(current.config.v2rayProfiles?.[profile] ?? {}), [key]: value };
    const next = { ...current, config: { ...current.config, v2rayProfiles: { ...current.config.v2rayProfiles, [profile]: profileMap } } };
    if (key === 'address' || key === 'endpoint') next.host = String(value);
    if (key === 'port') next.port = Number(value) || 0;
    return next;
  });

  const selectV2RayProfile = (profile: V2RayProfile) => {
    setForm((current) => ({ ...current, config: { ...current.config, v2rayProfile: profile, v2rayProfiles: { ...current.config.v2rayProfiles } } }));
    setProfilePickerOpen(false);
  };

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
    setProfilePickerOpen(false);
    setImportText('');
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
    setProfilePickerOpen(false);
    setImportText('');
    setEditorOpen(true);
  };

  const save = async () => {
    const endpoint = protocol === 'V2RAY' ? String(profileValues.address ?? profileValues.endpoint ?? form.host).trim() : form.host.trim();
    const port = protocol === 'V2RAY' ? Number(profileValues.port ?? form.port) : form.port;
    const missingProfileField = protocol === 'V2RAY' ? V2RAY_REQUIRED_FIELDS[v2rayProfile].find((key) => {
      const value = key === 'privateKey' ? privateKey : profileValues[key];
      return value === undefined || value === null || String(value).trim() === '' || value === 0;
    }) : undefined;
    if (!form.name.trim() || !endpoint || !port || missingProfileField) {
      const missing = missingProfileField ? ' Required field: ' + missingProfileField + '.' : '';
      Alert.alert('Missing server details', 'Add the required address and port before saving.' + missing);
      return;
    }
    const input = protocol === 'V2RAY'
      ? { ...form, host: endpoint, port, config: { ...form.config, v2rayProfile, v2rayProfiles: { ...form.config.v2rayProfiles, [v2rayProfile]: profileValues } } }
      : form;
    if (editingId) await editCustomServer(editingId, input, sshUsername, sshPassword, privateKey);
    else await addCustomServer(input, sshUsername, sshPassword, privateKey);
    setEditorOpen(false);
  };

  const remove = async (server: Server) => {
    await deleteCustomServer(server.id);
    setDetailServer(null);
  };

  const textInput = (testID: string, value: string, placeholder: string, onChangeText: (value: string) => void, extraStyle?: object, secureTextEntry = false) => (
    <TextInput
      testID={testID}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      secureTextEntry={secureTextEntry}
      style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary }, extraStyle]}
    />
  );

  const profileInput = (key: string, placeholder: string, extraStyle?: object, secureTextEntry = false) => textInput('v2ray-' + key, String(profileValues[key] ?? ''), placeholder, (value) => updateProfileValue(key, value), extraStyle, secureTextEntry);
  const profileSelect = (key: string, label: string, options: string[]) => <SelectRow label={label} value={String(profileValues[key] ?? options[0])} options={options} colors={colors} onChange={(value) => updateProfileValue(key, value)} />;
  const profileSwitch = (key: string, label: string) => <View style={styles.switchRow}><Text style={[styles.switchLabel, { color: colors.foreground }]}>{label}</Text><Switch value={Boolean(profileValues[key])} onValueChange={(value) => updateProfileValue(key, value)} trackColor={{ false: colors.border, true: colors.mutedForeground }} thumbColor={colors.foreground} /></View>;

  const showGeneratedConfig = () => {
    const generated = JSON.stringify({ profile: v2rayProfile, config: profileValues }, null, 2);
    Alert.alert('Generated configuration', generated);
  };

  const applyImportedConfig = () => {
    const imported = importedProfile(importText);
    if (!imported) {
      Alert.alert('Unsupported config', 'Paste a vless://, vmess://, trojan://, ss://, socks://, or http:// configuration.');
      return;
    }
    setForm((current) => ({ ...current, protocol: 'V2RAY', host: String(imported.values.address ?? current.host), port: Number(imported.values.port ?? current.port), config: { ...current.config, v2rayProfile: imported.profile, v2rayProfiles: { ...current.config.v2rayProfiles, [imported.profile]: imported.values } } }));
    setImportConfigOpen(false);
    setProfilePickerOpen(false);
    Alert.alert('Config imported', imported.profile + ' fields were populated and are ready to review.');
  };

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
      const network = String(profileValues.network ?? 'tcp').toLowerCase();
      const security = String(profileValues.security ?? 'none').toLowerCase();
      return <View style={styles.tunnelFields}>
        <View style={styles.profileTitleRow}><Text style={[styles.subsectionLabel, { color: colors.mutedForeground }]}>V2Ray Profile</Text><Pressable style={styles.importChip} onPress={async () => { const clipboard = await Clipboard.getStringAsync(); setImportText(clipboard); setImportConfigOpen(true); }}><Ionicons name="folder-open-outline" size={14} color={colors.foreground} /><Text style={[styles.importText, { color: colors.foreground }]}>Import Config</Text></Pressable></View>
        <View style={styles.profilePickerWrap}>
          <Pressable testID="v2ray-profile-picker" onPress={() => setProfilePickerOpen((open) => !open)} style={styles.profileRow}><Text style={[styles.profileValue, { color: colors.foreground }]}>{v2rayProfile}</Text><Ionicons name="clipboard-outline" size={20} color={colors.mutedForeground} /><Pressable onPress={(event) => { event.stopPropagation(); showGeneratedConfig(); }} hitSlop={8}><Ionicons name="code-slash-outline" size={20} color={colors.mutedForeground} /></Pressable><Ionicons name={profilePickerOpen ? 'chevron-up' : 'chevron-down'} size={17} color={colors.mutedForeground} /></Pressable>
          {profilePickerOpen ? <View style={styles.profileMenu}>{V2RAY_PROFILES.map((profile) => <Pressable key={profile} onPress={() => selectV2RayProfile(profile)} style={({ pressed }) => [styles.profileMenuItem, profile === v2rayProfile && styles.profileMenuSelected, pressed && styles.pressed]}><Text style={[styles.profileMenuText, { color: colors.foreground }]}>{profile}</Text>{profile === v2rayProfile ? <Ionicons name="checkmark" size={17} color={colors.primary} /> : null}</Pressable>)}</View> : null}
        </View>
        {v2rayProfile === 'WireGuard' ? <>
          <Text style={[styles.subsectionLabel, { color: colors.mutedForeground }]}>Server</Text>
          <View style={styles.splitRow}>{profileInput('endpoint', 'Endpoint', styles.splitInput)}{profileInput('port', 'Port', styles.portInput)}</View>
          {textInput('v2ray-private-key', privateKey, 'Private Key', setPrivateKey, styles.largeInput, true)}
          {profileInput('publicKey', 'Public Key')}{profileInput('clientAddress', 'Client Address')}{profileInput('dns', 'DNS')}{profileInput('mtu', 'MTU')}{profileInput('allowedIps', 'Allowed IPs')}{profileInput('keepalive', 'Persistent Keepalive')}
        </> : <>
          <Text style={[styles.subsectionLabel, { color: colors.mutedForeground }]}>Server</Text>
          <View style={styles.splitRow}>{profileInput('address', 'Server / Address', styles.splitInput)}{profileInput('port', 'Port', styles.portInput)}</View>
          {v2rayProfile === 'Shadowsocks' ? <>{profileSelect('method', 'Method', ['aes-128-gcm', 'aes-256-gcm', 'chacha20-ietf-poly1305'])}{profileInput('password', 'Password', undefined, true)}{profileSelect('network', 'Network', ['tcp', 'ws'])}{profileSwitch('tls', 'TLS')}</> : null}
          {v2rayProfile === 'Socks' ? <>{profileInput('username', 'Username')}{profileInput('password', 'Password', undefined, true)}{profileSwitch('udp', 'UDP')}</> : null}
          {v2rayProfile === 'HTTP' ? <>{profileInput('username', 'Username')}{profileInput('password', 'Password', undefined, true)}{profileSwitch('tls', 'TLS / HTTPS')}</> : null}
          {v2rayProfile === 'Trojan' ? <>{profileInput('password', 'Password', undefined, true)}{profileSelect('security', 'Security / TLS', ['tls', 'none'])}{profileInput('sni', 'SNI / Server Name')}{profileInput('fingerprint', 'Fingerprint')}{profileSelect('network', 'Network', ['tcp', 'ws', 'grpc'])}{network === 'ws' ? <>{profileInput('path', 'Path')}{profileInput('host', 'Host')}</> : null}{network === 'grpc' ? profileInput('serviceName', 'Service Name') : null}</> : null}
          {v2rayProfile === 'Hysteria2' ? <>{profileInput('password', 'Password / Authentication', undefined, true)}{profileInput('sni', 'SNI / Server Name')}{profileInput('alpn', 'ALPN')}{profileInput('obfs', 'Obfuscation')}{profileSwitch('fastOpen', 'Fast Open')}</> : null}
          {v2rayProfile === 'V2Ray Default' || v2rayProfile === 'VLESS' || v2rayProfile === 'VMess' ? <>
            <Text style={[styles.subsectionLabel, { color: colors.mutedForeground }]}>{v2rayProfile === 'VMess' ? 'VMess settings' : 'VLESS settings'}</Text>
            {profileInput('uuid', 'UUID', undefined, false)}
            {v2rayProfile === 'V2Ray Default' ? profileInput('password', 'Password', undefined, true) : null}
            {v2rayProfile === 'VLESS' ? profileSelect('encryption', 'Encryption', ['none']) : null}
            {v2rayProfile === 'VMess' ? <>{profileInput('alterId', 'Alter ID')}{profileSelect('security', 'Security', ['auto', 'none', 'aes-128-gcm', 'chacha20-poly1305'])}{profileSwitch('tls', 'TLS')}</> : null}
            {v2rayProfile === 'VLESS' || v2rayProfile === 'V2Ray Default' ? profileSelect('flow', 'Flow', ['none', 'xtls-rprx-vision']) : null}
            <Text style={[styles.subsectionLabel, { color: colors.mutedForeground }]}>Transport</Text>
            {profileSelect('network', 'Network', ['tcp', 'ws', 'grpc', 'http2', 'quic'])}
            {profileSelect('security', 'Security / TLS', ['none', 'tls', 'reality'])}
            {security === 'tls' || security === 'reality' ? <>{profileInput('sni', 'SNI / Server Name')}{profileInput('fingerprint', 'Fingerprint')}</> : null}
            {security === 'reality' ? <>{profileInput('publicKey', 'Public Key')}{profileInput('shortId', 'Short ID')}{profileInput('spiderX', 'SpiderX / Spider Path')}</> : null}
            {network === 'ws' ? <>{profileInput('path', 'Path')}{profileInput('host', 'Host')}</> : null}
            {network === 'grpc' ? profileInput('serviceName', 'Service Name') : null}
          </> : null}
        </>}
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
    <ModalShell visible={importConfigOpen} title="Import V2Ray Config" subtitle="Paste an authorized connection URI. The profile and supported fields will be populated for review." onClose={() => setImportConfigOpen(false)}><View style={styles.importModal}><TextInput value={importText} onChangeText={setImportText} multiline autoCapitalize="none" placeholder="vless://… or trojan://…" placeholderTextColor={colors.mutedForeground} style={[styles.importInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary }]} /><PrimaryButton title="IMPORT CONFIG" icon="download-outline" onPress={applyImportedConfig} /></View></ModalShell>
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
  profileTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profilePickerWrap: { position: 'relative', zIndex: 20 },
  profileRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 18 },
  profileValue: { fontFamily: 'Inter_400Regular', fontSize: 16, flex: 1, paddingLeft: 8 },
  profileMenu: { position: 'absolute', top: 51, left: 0, width: '78%', borderRadius: 14, paddingVertical: 6, backgroundColor: '#292d38', borderWidth: 1, borderColor: '#3b4150', elevation: 10, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  profileMenuItem: { minHeight: 42, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profileMenuSelected: { backgroundColor: '#353b48' },
  profileMenuText: { fontFamily: 'Inter_400Regular', fontSize: 15 },
  splitRow: { flexDirection: 'row', gap: 10 },
  splitInput: { flex: 1 },
  portInput: { width: 120 },
  switchRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 },
  switchLabel: { fontFamily: 'Inter_400Regular', fontSize: 15 },
  infoRow: { flexDirection: 'row', gap: 7, alignItems: 'flex-start', marginTop: 4 },
  infoText: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, flex: 1 },
  securityNote: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, marginTop: 11 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  importModal: { gap: 14, marginTop: 14 },
  importInput: { minHeight: 140, borderWidth: 1, borderRadius: 15, padding: 14, textAlignVertical: 'top', fontFamily: 'Inter_400Regular', fontSize: 13 },
  details: { gap: 11, marginTop: 15 },
  detailRow: { gap: 5 },
  detailLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 0.9, textTransform: 'uppercase' },
  detailValue: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
  pressed: { opacity: 0.75 },
});