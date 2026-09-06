import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Network from 'expo-network';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BUILT_IN_SERVERS } from '@/data/serverCatalog';
import { BUILT_IN_TWEAKS } from '@/data/tweakCatalog';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'unavailable';
export type FastestStatus = 'idle' | 'finding' | 'selected' | 'unavailable';

export type Server = {
  id: string;
  name: string;
  country: string;
  flag: string;
  host: string;
  port: number;
  protocol: string;
  provider: string;
  source: string;
  latency: number | null;
  enabled: boolean;
  isCustom?: boolean;
  hasCredentials?: boolean;
  category?: string;
  note?: string;
  hasPrivateKey?: boolean;
  config?: CustomServerConfig;
};

export type Tweak = {
  id: string;
  name: string;
  country: string;
  flag: string;
  connectionType: 'Direct SSH' | 'SSL/TLS' | 'HTTP' | 'WebSocket';
  host: string;
  port: number;
  sni: string;
  proxyHost: string;
  proxyPort: number;
  payloadConfiguration: string;
  provider: string;
  enabled: boolean;
  isCustom?: boolean;
};

export type AppLog = {
  id: string;
  time: string;
  type: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'DNS' | 'NETWORK' | 'ERROR' | 'CHECK';
  message: string;
};

type Settings = {
  customTweak: boolean;
  forwardUdp: boolean;
  customUdpHost: string;
  customUdpPort: string;
  notificationSound: boolean;
  vibrate: boolean;
  cpuWakelock: boolean;
  batteryOptimization: boolean;
  forwardDns: boolean;
  customDns: string;
  mobileNetwork: boolean;
  shareHotspot: boolean;
};

export type V2RayProfile = 'V2Ray Default' | 'VLESS' | 'VMess' | 'Shadowsocks' | 'Socks' | 'HTTP' | 'Trojan' | 'Hysteria2' | 'WireGuard';
export type V2RayProfileValues = Record<string, string | number | boolean>;

export type CustomServerConfig = {
  openvpnType?: string;
  openvpnConfig?: string;
  dnsttPublicKey?: string;
  udpTransfer?: string;
  udpAlpn?: string;
  udpPortHoppingInterval?: number;
  udpAllowInsecure?: boolean;
  v2rayProfile?: V2RayProfile;
  v2rayProfiles?: Partial<Record<V2RayProfile, V2RayProfileValues>>;
  v2rayHost?: string;
  v2rayPort?: number;
  v2rayUuid?: string;
  v2rayFlow?: string;
  v2rayNetwork?: string;
  v2rayHeaderType?: string;
  v2rayMux?: boolean;
  v2raySecurity?: string;
};

export type CustomServerInput = {
  name: string;
  country: string;
  flag: string;
  host: string;
  port: number;
  protocol: string;
  provider: string;
  source: string;
  category: string;
  note: string;
  config: CustomServerConfig;
};

export type CustomTweakInput = Omit<Tweak, 'id' | 'isCustom' | 'enabled' | 'provider'>;

type AppStateData = {
  status: ConnectionStatus;
  selectedServerId: string;
  selectedProfileId: string;
  accessExpiresAt: number | null;
  connectionStartedAt: number | null;
  configVersion: string;
  settings: Settings;
  logs: AppLog[];
  customServers: Server[];
  customTweaks: Tweak[];
};

type AppStateContextValue = AppStateData & {
  servers: Server[];
  tweaks: Tweak[];
  accessRemainingSeconds: number;
  isAccessExpired: boolean;
  fastestStatus: FastestStatus;
  fastestMessage: string;
  selectServer: (serverId: string) => void;
  findFastestServer: () => Promise<void>;
  selectProfile: (profileId: string) => void;
  toggleSetting: (key: keyof Settings) => void;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  requestConnection: () => void;
  disconnect: () => void;
  grantAccess: (hours: number) => void;
  addCustomServer: (input: CustomServerInput, sshUsername: string, sshPassword: string, privateKey: string) => Promise<void>;
  editCustomServer: (id: string, input: CustomServerInput, sshUsername: string, sshPassword: string, privateKey: string) => Promise<void>;
  deleteCustomServer: (id: string) => Promise<void>;
  testServer: (id: string) => void;
  addCustomTweak: (input: CustomTweakInput) => void;
  editCustomTweak: (id: string, input: CustomTweakInput) => void;
  duplicateTweak: (id: string) => void;
  deleteCustomTweak: (id: string) => void;
  testTweak: (id: string) => void;
  clearLogs: () => void;
  clearAppData: () => void;
  updateConfig: () => Promise<{ success: boolean; message: string }>;
};

const STORAGE_KEY = 'aries-tunnel-state-v2';
const DEFAULT_STATE: AppStateData = {
  status: 'disconnected',
  selectedServerId: 'random-fastest',
  selectedProfileId: 'tweak-sg-stable',
  accessExpiresAt: null,
  connectionStartedAt: null,
  configVersion: 'Local config',
  settings: { customTweak: false, forwardUdp: true, customUdpHost: '', customUdpPort: '7300', notificationSound: true, vibrate: true, cpuWakelock: false, batteryOptimization: false, forwardDns: true, customDns: '', mobileNetwork: true, shareHotspot: false },
  logs: [],
  customServers: [],
  customTweaks: [],
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

function makeLog(type: AppLog['type'], message: string): AppLog {
  return { id: Date.now().toString() + Math.random().toString(36).slice(2, 8), time: new Date().toISOString(), type, message };
}

function secureKey(kind: 'username' | 'password' | 'privateKey', id: string) {
  return 'aries-tunnel-' + kind + '-' + id;
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppStateData>(DEFAULT_STATE);
  const [now, setNow] = useState<number>(Date.now());
  const [fastestStatus, setFastestStatus] = useState<FastestStatus>('idle');
  const [fastestMessage, setFastestMessage] = useState('');
  const wakeLockActive = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (!saved) return;
      try {
        const parsed = JSON.parse(saved) as Partial<AppStateData> & { customServer?: Server | null };
        setState({ ...DEFAULT_STATE, ...parsed, customServers: parsed.customServers ?? (parsed.customServer ? [parsed.customServer] : []), customTweaks: parsed.customTweaks ?? [], settings: { ...DEFAULT_STATE.settings, ...parsed.settings } });
      } catch {
        setState(DEFAULT_STATE);
      }
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (state.settings.cpuWakelock) {
      activateKeepAwakeAsync('aries-tunnel').then(() => {
        wakeLockActive.current = true;
      }).catch(() => undefined);
    } else if (wakeLockActive.current) {
      try {
        void deactivateKeepAwake('aries-tunnel');
      } catch {
        // Expo can throw if the native wake lock was already released.
      }
      wakeLockActive.current = false;
    }
    return () => {
      if (wakeLockActive.current) {
        try {
          void deactivateKeepAwake('aries-tunnel');
        } catch {
          // Expo can throw if the native wake lock was already released.
        }
        wakeLockActive.current = false;
      }
    };
  }, [state.settings.cpuWakelock]);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined);
  }, [state]);

  const servers = useMemo(() => [...BUILT_IN_SERVERS, ...state.customServers], [state.customServers]);
  const tweaks = useMemo(() => [...BUILT_IN_TWEAKS, ...state.customTweaks], [state.customTweaks]);
  const accessRemainingSeconds = Math.max(0, Math.floor(((state.accessExpiresAt ?? 0) - now) / 1000));
  const isAccessExpired = accessRemainingSeconds === 0;

  const findFastestServer = useCallback(async () => {
    setFastestStatus('finding');
    setFastestMessage('Finding fastest server...');
    await new Promise((resolve) => setTimeout(resolve, 650));
    const eligible = servers.filter((server) => server.id !== 'random-fastest' && server.enabled && Boolean(server.host) && server.latency !== null).sort((a, b) => (a.latency ?? 9999) - (b.latency ?? 9999));
    if (!eligible[0]) {
      setFastestStatus('unavailable');
      setFastestMessage('No authorized endpoint is configured.');
      setState((current) => ({ ...current, logs: [makeLog('ERROR', 'Fastest-server check found no authorized endpoint.'), ...current.logs].slice(0, 100) }));
      return;
    }
    setFastestStatus('selected');
    setFastestMessage('Connected to ' + eligible[0].country + ' in the selection preview.');
    setState((current) => ({ ...current, selectedServerId: eligible[0].id, logs: [makeLog('NETWORK', 'Fastest authorized endpoint selected: ' + eligible[0].country + '.'), ...current.logs].slice(0, 100) }));
  }, [servers]);

  const selectServer = useCallback((serverId: string) => {
    if (serverId === 'random-fastest') {
      void findFastestServer();
      return;
    }
    setFastestStatus('idle');
    setFastestMessage('');
    setState((current) => ({ ...current, selectedServerId: serverId }));
  }, [findFastestServer]);

  const selectProfile = useCallback((profileId: string) => setState((current) => ({ ...current, selectedProfileId: profileId })), []);
  const toggleSetting = useCallback((key: keyof Settings) => setState((current) => ({ ...current, settings: { ...current.settings, [key]: !current.settings[key] } })), []);
  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => setState((current) => ({ ...current, settings: { ...current.settings, [key]: value } })), []);

  const requestConnection = useCallback(() => {
    setState((current) => {
      const message = isAccessExpired ? 'Access expired. Earn time before connecting.' : 'Unable to establish VPN connection: Android VpnService backend is not configured.';
      const connectingLog = makeLog('CONNECTING', 'VPN connection requested. Checking access and authorized endpoint.');
      return { ...current, status: 'unavailable', logs: [makeLog('ERROR', message), connectingLog, ...current.logs].slice(0, 100) };
    });
  }, [isAccessExpired]);

  const disconnect = useCallback(() => setState((current) => ({ ...current, status: 'disconnected', connectionStartedAt: null, logs: [makeLog('DISCONNECTED', 'Tunnel disconnected by user.'), ...current.logs].slice(0, 100) })), []);

  const grantAccess = useCallback((hours: number) => setState((current) => {
    const base = Math.max(current.accessExpiresAt ?? 0, Date.now());
    return { ...current, accessExpiresAt: base + hours * 60 * 60 * 1000, logs: [makeLog('NETWORK', '+' + hours + ' hours VPN access added.'), ...current.logs].slice(0, 100) };
  }), []);

  const addCustomServer = useCallback(async (input: CustomServerInput, sshUsername: string, sshPassword: string, privateKey: string) => {
    const id = 'custom-server-' + Date.now().toString();
    const server: Server = { ...input, id, latency: null, enabled: Boolean(input.host), isCustom: true, hasCredentials: Boolean(sshUsername || sshPassword), hasPrivateKey: Boolean(privateKey) };
    if (sshUsername) await SecureStore.setItemAsync(secureKey('username', id), sshUsername);
    if (sshPassword) await SecureStore.setItemAsync(secureKey('password', id), sshPassword);
    if (privateKey) await SecureStore.setItemAsync(secureKey('privateKey', id), privateKey);
    setState((current) => ({ ...current, customServers: [...current.customServers, server], selectedServerId: id, logs: [makeLog('NETWORK', 'Custom server profile saved locally with secure credentials.'), ...current.logs].slice(0, 100) }));
  }, []);

  const editCustomServer = useCallback(async (id: string, input: CustomServerInput, sshUsername: string, sshPassword: string, privateKey: string) => {
    const server: Server = { ...input, id, latency: null, enabled: Boolean(input.host), isCustom: true, hasCredentials: Boolean(sshUsername || sshPassword), hasPrivateKey: Boolean(privateKey) };
    if (sshUsername) await SecureStore.setItemAsync(secureKey('username', id), sshUsername);
    if (sshPassword) await SecureStore.setItemAsync(secureKey('password', id), sshPassword);
    if (privateKey) await SecureStore.setItemAsync(secureKey('privateKey', id), privateKey);
    setState((current) => ({ ...current, customServers: current.customServers.map((item) => item.id === id ? server : item), logs: [makeLog('NETWORK', 'Custom server profile updated.'), ...current.logs].slice(0, 100) }));
  }, []);

  const deleteCustomServer = useCallback(async (id: string) => {
    await SecureStore.deleteItemAsync(secureKey('username', id));
    await SecureStore.deleteItemAsync(secureKey('password', id));
    await SecureStore.deleteItemAsync(secureKey('privateKey', id));
    setState((current) => ({ ...current, customServers: current.customServers.filter((item) => item.id !== id), selectedServerId: current.selectedServerId === id ? 'random-fastest' : current.selectedServerId, logs: [makeLog('NETWORK', 'Custom server profile deleted.'), ...current.logs].slice(0, 100) }));
  }, []);

  const testServer = useCallback((id: string) => {
    const server = servers.find((item) => item.id === id);
    const message = !server?.host ? 'Unable to test server: no authorized host is configured.' : 'Server test queued, but no Android VPN backend is connected yet.';
    setState((current) => ({ ...current, logs: [makeLog('ERROR', message), ...current.logs].slice(0, 100) }));
  }, [servers]);

  const addCustomTweak = useCallback((input: CustomTweakInput) => setState((current) => ({ ...current, customTweaks: [...current.customTweaks, { ...input, id: 'custom-tweak-' + Date.now().toString(), provider: 'Local profile', enabled: Boolean(input.host), isCustom: true }], logs: [makeLog('NETWORK', 'Custom tweak saved locally.'), ...current.logs].slice(0, 100) })), []);
  const editCustomTweak = useCallback((id: string, input: CustomTweakInput) => setState((current) => ({ ...current, customTweaks: current.customTweaks.map((item) => item.id === id ? { ...input, id, provider: 'Local profile', enabled: Boolean(input.host), isCustom: true } : item) })), []);
  const duplicateTweak = useCallback((id: string) => setState((current) => { const source = current.customTweaks.find((item) => item.id === id); return source ? { ...current, customTweaks: [...current.customTweaks, { ...source, id: 'custom-tweak-' + Date.now().toString(), name: source.name + ' Copy' }] } : current; }), []);
  const deleteCustomTweak = useCallback((id: string) => setState((current) => ({ ...current, customTweaks: current.customTweaks.filter((item) => item.id !== id), selectedProfileId: current.selectedProfileId === id ? 'tweak-sg-stable' : current.selectedProfileId })), []);
  const testTweak = useCallback((id: string) => setState((current) => ({ ...current, logs: [makeLog('ERROR', 'Tweak test queued for authorized configuration only; backend is not connected.'), ...current.logs].slice(0, 100) })), []);
  const clearLogs = useCallback(() => setState((current) => ({ ...current, logs: [] })), []);
  const clearAppData = useCallback(() => { void Promise.all(state.customServers.flatMap((server) => [SecureStore.deleteItemAsync(secureKey('username', server.id)), SecureStore.deleteItemAsync(secureKey('password', server.id)), SecureStore.deleteItemAsync(secureKey('privateKey', server.id))])); setState(DEFAULT_STATE); }, [state.customServers]);
  const updateConfig = useCallback(async () => {
    const endpoint = process.env.EXPO_PUBLIC_CONFIG_URL?.trim();
    if (!endpoint) return { success: false, message: 'Internet checks are ready, but a config endpoint has not been configured yet.' };
    try {
      const network = await Network.getNetworkStateAsync();
      if (!network.isConnected || network.isInternetReachable === false) return { success: false, message: 'No internet connection is available. Try again when the device is online.' };
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Config server returned HTTP ' + response.status + '.');
      const payload = await response.json() as { version?: unknown };
      const nextVersion = typeof payload.version === 'string' && payload.version.trim() ? payload.version.trim() : null;
      if (!nextVersion) return { success: false, message: 'The config response did not include a valid version.' };
      if (nextVersion === state.configVersion) return { success: true, message: 'Config is already up to date (' + nextVersion + ').' };
      setState((current) => ({ ...current, configVersion: nextVersion, logs: [makeLog('NETWORK', 'Remote config updated to version ' + nextVersion + '.'), ...current.logs].slice(0, 100) }));
      return { success: true, message: 'Config updated to version ' + nextVersion + '.' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The config update failed.';
      setState((current) => ({ ...current, logs: [makeLog('ERROR', 'Config update failed: ' + message), ...current.logs].slice(0, 100) }));
      return { success: false, message };
    }
  }, [state.configVersion]);

  useEffect(() => {
    let cancelled = false;
    const refreshWhenOnline = async () => {
      const endpoint = process.env.EXPO_PUBLIC_CONFIG_URL?.trim();
      if (!endpoint || cancelled) return;
      try {
        const network = await Network.getNetworkStateAsync();
        if (!cancelled && network.isConnected && network.isInternetReachable !== false) void updateConfig();
      } catch {
        // A failed connectivity check should not interrupt the tunnel UI.
      }
    };
    void refreshWhenOnline();
    const timer = setInterval(() => { void refreshWhenOnline(); }, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [updateConfig]);

  const value = useMemo<AppStateContextValue>(() => ({ ...state, servers, tweaks, accessRemainingSeconds, isAccessExpired, fastestStatus, fastestMessage, selectServer, findFastestServer, selectProfile, toggleSetting, updateSetting, requestConnection, disconnect, grantAccess, addCustomServer, editCustomServer, deleteCustomServer, testServer, addCustomTweak, editCustomTweak, duplicateTweak, deleteCustomTweak, testTweak, clearLogs, clearAppData, updateConfig }), [state, servers, tweaks, accessRemainingSeconds, isAccessExpired, fastestStatus, fastestMessage, selectServer, findFastestServer, selectProfile, toggleSetting, updateSetting, requestConnection, disconnect, grantAccess, addCustomServer, editCustomServer, deleteCustomServer, testServer, addCustomTweak, editCustomTweak, duplicateTweak, deleteCustomTweak, testTweak, clearLogs, clearAppData, updateConfig]);
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useAppState must be used inside AppStateProvider');
  return value;
}

export const REWARDED_AD_TEST_ID = 'ca-app-pub-3940256099942544/5224354917';
export const RewardManager = { async showRewardedAd(): Promise<boolean> { return false; } };
