import React, { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Header, PrimaryButton, Screen, Surface } from '@/components/Primitives';
import { ChipRow, Field, FieldLabel, RadioOption, SelectRow } from '@/components/FormFields';
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
  const { tweaks, customTweaks, selectedConfigId, selectConfig, addCustomTweak, editCustomTweak, duplicateTweak, deleteCustomTweak } = useAppState();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const custom = useMemo(() => customTweaks.filter((tweak) => (tweak.name + ' ' + tweak.connectionType + ' ' + tweak.host).toLowerCase().includes(query.trim().toLowerCase())), [customTweaks, query]);

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

  return <Screen>
    <Header eyebrow="Profiles" title="Tweaks" action={editingId ? 'New' : undefined} onAction={editingId ? reset : undefined} />
    <View style={styles.actions}><Pressable testID="save-tweak" onPress={save} style={({ pressed }) => [styles.save, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Text style={[styles.saveText, { color: colors.primaryForeground }]}>{editingId ? 'Update' : 'Save'}</Text></Pressable></View>

    <Surface style={styles.listCard}>
      <Field value={query} onChangeText={setQuery} placeholder="Search saved tweaks" />
      <Text style={[styles.section, { color: colors.foreground }]}>Saved custom tweaks</Text>
      {custom.length === 0 ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>No custom tweaks yet.</Text> : custom.map((tweak) => <View key={tweak.id} testID={'custom-tweak-' + tweak.id} style={[styles.item, { borderColor: tweak.id === selectedConfigId ? colors.primary : colors.border, backgroundColor: tweak.id === selectedConfigId ? colors.accent : colors.secondary }]}>
        <Pressable testID={'select-custom-tweak-' + tweak.id} style={styles.itemCopy} onPress={() => selectConfig(tweak.id)}><Text style={[styles.itemName, { color: colors.foreground }]}>{tweak.name}</Text><Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>{tweak.connectionType} • {tweak.host || 'no host'}</Text></Pressable>
        <Pressable testID={'edit-custom-tweak-' + tweak.id} onPress={() => fill(tweak)} hitSlop={8}><Ionicons name="create-outline" size={18} color={colors.primary} /></Pressable>
        <Pressable onPress={() => duplicateTweak(tweak.id)} hitSlop={8}><Ionicons name="copy-outline" size={18} color={colors.mutedForeground} /></Pressable>
        <Pressable onPress={() => { void runTest(tweak); }} hitSlop={8}><Ionicons name="flash-outline" size={18} color={colors.mutedForeground} /></Pressable>
        <Pressable testID={'delete-custom-tweak-' + tweak.id} onPress={() => confirmDelete(tweak)} hitSlop={8}><Ionicons name="trash-outline" size={18} color={colors.destructive} /></Pressable>
      </View>)}
      <Text style={[styles.section, { color: colors.foreground, marginTop: 16 }]}>Built-in tweaks</Text>
      {tweaks.filter((tweak) => !tweak.isCustom).map((tweak) => <Pressable key={tweak.id} onPress={() => { selectConfig(tweak.id); fill(tweak); }} style={({ pressed }) => [styles.item, { borderColor: tweak.id === selectedConfigId ? colors.primary : colors.border, backgroundColor: tweak.id === selectedConfigId ? colors.accent : colors.secondary }, pressed && styles.pressed]}><View style={styles.itemCopy}><Text style={[styles.itemName, { color: colors.foreground }]}>{tweak.flag}  {tweak.name}</Text><Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>{tweak.country} • {tweak.connectionType}</Text></View></Pressable>)}
    </Surface>

    <Surface>
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
  </Screen>;
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 14 },
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
  pressed: { opacity: 0.7 },
});
