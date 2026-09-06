import React, { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ResponseCheckInput, ResponseCheckResult, checkEndpoint } from '@/services/responseChecker';
import { useColors } from '@/hooks/useColors';
import { Screen } from '@/components/Primitives';

const EMPTY_INPUT: ResponseCheckInput = {
  host: '',
  port: '',
  sni: '',
  proxyHost: '',
  proxyPort: '',
  customHeaders: '',
  method: 'GET',
  proxyEnabled: false,
  ipInfoEnabled: false,
  cdnFinderEnabled: false,
};

export default function ResponseCheckerScreen() {
  const colors = useColors();
  const router = useRouter();
  const [input, setInput] = useState<ResponseCheckInput>(EMPTY_INPUT);
  const [result, setResult] = useState<ResponseCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const update = (key: keyof ResponseCheckInput, value: string) => setInput((current) => ({ ...current, [key]: value }));
  const toggle = (key: 'proxyEnabled' | 'ipInfoEnabled' | 'cdnFinderEnabled') => setInput((current) => ({ ...current, [key]: !current[key] }));
  const check = async () => {
    if (!input.host.trim()) {
      setError('Enter a host or URL first.');
      return;
    }
    setChecking(true);
    setResult(null);
    setError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try {
      setResult(await checkEndpoint(input));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'The response check could not be started.');
    } finally {
      setChecking(false);
    }
  };
  const field = (key: keyof ResponseCheckInput, placeholder: string, extra?: object) => (
    <TextInput
      value={String(input[key] ?? '')}
      onChangeText={(value) => update(key, value)}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      autoCapitalize="none"
      style={[styles.input, { color: colors.foreground, borderBottomColor: colors.border }, extra]}
    />
  );

  return <Screen>
    <View style={[styles.topBar, { backgroundColor: colors.card }]}>
      <Pressable accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={10} style={styles.backButton}><Ionicons name="arrow-back" size={21} color={colors.foreground} /></Pressable>
      <Text style={[styles.topTitle, { color: colors.foreground }]}>Response checker</Text>
      <View style={styles.topSpacer} />
    </View>
    <View style={styles.content}>
      <Text style={[styles.pageTitle, { color: colors.foreground }]}>Response checker</Text>
      <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>Check an authorized host before using its server profile.</Text>
      {field('host', 'Host or URL')}
      <View style={styles.hostUnderline} />
      <View style={styles.options}>
        <CheckOption label="Proxy" value={Boolean(input.proxyEnabled)} onPress={() => toggle('proxyEnabled')} colors={colors} />
        <CheckOption label="IP Info" value={Boolean(input.ipInfoEnabled)} onPress={() => toggle('ipInfoEnabled')} colors={colors} />
        <CheckOption label="CDN Finder" value={Boolean(input.cdnFinderEnabled)} onPress={() => toggle('cdnFinderEnabled')} colors={colors} />
      </View>
      {input.proxyEnabled ? <View style={styles.proxyFields}><View style={styles.proxyField}>{field('proxyHost', 'Proxy host')}</View><View style={styles.proxyPort}>{field('proxyPort', 'Port')}</View></View> : null}
      {input.proxyEnabled ? <Text style={[styles.proxyNote, { color: colors.mutedForeground }]}>Proxy details are saved for the native tunnel backend. Expo’s current fetch path checks the host directly and does not route arbitrary HTTP traffic through this proxy.</Text> : null}
      <Pressable onPress={() => { void check(); }} disabled={checking} style={({ pressed }) => [styles.startButton, { borderColor: colors.primary }, pressed && styles.pressed]}>
        {checking ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="play" size={17} color={colors.primary} />}
        <Text style={[styles.startText, { color: colors.primary }]}>{checking ? 'CHECKING' : 'START'}</Text>
      </Pressable>
      {error ? <Text style={[styles.error, { color: colors.primary }]}>{error}</Text> : null}
      {result ? <ResultCard result={result} colors={colors} /> : <View style={[styles.empty, { borderColor: colors.border }]}><Ionicons name="pulse-outline" size={27} color={colors.mutedForeground} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>Ready to check</Text><Text style={[styles.emptyText, { color: colors.mutedForeground }]}>The checker measures reachability only. It does not claim that an HTTP response is a working VPN tunnel.</Text></View>}
    </View>
  </Screen>;
}

function CheckOption({ label, value, onPress, colors }: { label: string; value: boolean; onPress: () => void; colors: ReturnType<typeof useColors> }) {
  return <Pressable onPress={onPress} style={styles.checkOption}><View style={[styles.checkbox, { borderColor: value ? colors.primary : colors.mutedForeground, backgroundColor: value ? colors.primary : 'transparent' }]}>{value ? <Ionicons name="checkmark" size={13} color={colors.primaryForeground} /> : null}</View><Text style={[styles.optionText, { color: colors.foreground }]}>{label}</Text></Pressable>;
}

function ResultCard({ result, colors }: { result: ResponseCheckResult; colors: ReturnType<typeof useColors> }) {
  return <View style={[styles.result, { borderColor: result.reachable ? colors.success : colors.primary, backgroundColor: colors.card }]}>
    <View style={styles.resultHeader}><View><Text style={[styles.resultEyebrow, { color: colors.mutedForeground }]}>RESPONSE</Text><Text style={[styles.resultStatus, { color: result.reachable ? colors.success : colors.primary }]}>{result.reachable ? 'ONLINE' : 'UNREACHABLE'}</Text></View><Ionicons name={result.reachable ? 'checkmark-circle' : 'close-circle'} size={28} color={result.reachable ? colors.success : colors.primary} /></View>
    <View style={styles.resultGrid}><ResultCell label="HTTP" value={result.statusCode ? String(result.statusCode) : '—'} colors={colors} /><ResultCell label="RESPONSE" value={result.responseTime === null ? '—' : result.responseTime + ' ms'} colors={colors} /><ResultCell label="TLS" value={result.tlsStatus} colors={colors} /><ResultCell label="SNI" value={result.hostnameResult} colors={colors} /><ResultCell label="REDIRECT" value={result.redirect} colors={colors} /></View>
    {result.ipInfo ? <Text style={[styles.detail, { color: colors.mutedForeground }]}>IP: {result.ipInfo}</Text> : null}
    {result.cdnInfo ? <Text style={[styles.detail, { color: colors.mutedForeground }]}>CDN: {result.cdnInfo}</Text> : null}
    {result.headers.length ? <Text style={[styles.detail, { color: colors.mutedForeground }]}>{result.headers.join('\n')}</Text> : null}
    {result.error ? <Text style={[styles.error, { color: colors.primary }]}>{result.error}</Text> : null}
  </View>;
}

function ResultCell({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.resultCell}><Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>{label}</Text><Text style={[styles.resultValue, { color: colors.foreground }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  topBar: { marginHorizontal: -20, paddingHorizontal: 20, minHeight: 55, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 35, height: 35, justifyContent: 'center' },
  topTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  topSpacer: { width: 35 },
  content: { paddingTop: 28 },
  pageTitle: { fontFamily: 'Inter_700Bold', fontSize: 24 },
  pageSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 22 },
  input: { minHeight: 49, borderBottomWidth: 1, paddingHorizontal: 2, fontFamily: 'Inter_400Regular', fontSize: 16 },
  hostUnderline: { height: 2, width: 58, backgroundColor: '#50e388', marginTop: -2 },
  options: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 25, marginBottom: 16 },
  checkOption: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { width: 19, height: 19, borderWidth: 1.5, borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  optionText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  proxyFields: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  proxyField: { flex: 1 },
  proxyPort: { width: 90 },
  proxyNote: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, marginTop: 2 },
  startButton: { minHeight: 48, borderWidth: 1, borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 20 },
  startText: { fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 1.2 },
  pressed: { opacity: 0.72 },
  empty: { borderWidth: 1, borderRadius: 12, alignItems: 'center', padding: 24, marginTop: 26 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, marginTop: 10 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 6 },
  result: { borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 26 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1 },
  resultStatus: { fontFamily: 'Inter_700Bold', fontSize: 24, marginTop: 4 },
  resultGrid: { gap: 12, marginTop: 18 },
  resultCell: { gap: 3 },
  resultLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.8 },
  resultValue: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  detail: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, marginTop: 14 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18, marginTop: 16 },
});