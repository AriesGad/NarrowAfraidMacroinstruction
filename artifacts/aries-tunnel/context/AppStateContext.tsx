import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Network from 'expo-network';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BUILT_IN_SERVERS } from '@/data/serverCatalog';
import { BUILT_IN_TWEAKS } from '@/data/tweakCatalog';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'failed';
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
  category?: string;
  note?: string;
};

export type AppLog = {
  id: string;
  time: string;
  type: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTING' | 'DISCONNECTED' | 'FAILED';
  message: string;
};

export type Settings = {
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
  selectedServerId: string | null;
  selectedConfigId: string | null;
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
  configs: Tweak[];
  tweaks: Tweak[];
  accessRemainingSeconds: number;
  isAccessExpired: boolean;
  fastestStatus: FastestStatus;
  fastestMessage: string;
  selectServer: (serverId: string) => void;
  findFastestServer: () => Promise<void>;
  selectConfig: (configId: string) => void;
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
  selectedServerId: null,
  selectedConfigId: null,
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

const LIFECYCLE_LOG_TYPES: AppLog['type'][] = ['CONNECTING', 'CONNECTED', 'DISCONNECTING', 'DISCONNECTED', 'FAILED'];
function lifecycleLogs(value: unknown): AppLog[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is AppLog => Boolean(entry && typeof entry === 'object' && LIFECYCLE_LOG_TYPES.includes((entry as AppLog).type) && typeof (entry as AppLog).message === 'string'));
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
        const parsed = JSON.parse(saved) as Partial<AppStateData> & { customServer?: Server | null; selectedProfileId?: string | null };
        const customServers = parsed.customServers ?? (parsed.customServer ? [parsed.customServer] : []);
        const customTweaks = parsed.customTweaks ?? [];
        const selectedServerId = typeof parsed.selectedServerId === 'string' && (BUILT_IN_SERVERS.some((server) => server.id === parsed.selectedServerId && server.id !== 'random-fastest') || customServers.some((server) => server.id === parsed.selectedServerId)) ? parsed.selectedServerId : null;
        const legacyConfigId = parsed.selectedConfigId ?? parsed.selectedProfileId;
        const selectedConfigId = typeof legacyConfigId === 'string' && (BUILT_IN_TWEAKS.some((config) => config.id === legacyConfigId) || customTweaks.some((config) => config.id === legacyConfigId)) ? legacyConfigId : null;
        setState({ ...DEFAULT_STATE, ...parsed, selectedServerId, selectedConfigId, logs: lifecycleLogs(parsed.logs), customServers, customTweaks, settings: { ...DEFAULT_STATE.settings, ...parsed.settings } });
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
  const configs = useMemo(() => [...BUILT_IN_TWEAKS, ...state.customTweaks], [state.customTweaks]);
  const tweaks = configs;
  const accessRemainingSeconds = Math.max(0, Math.floor(((state.accessExpiresAt ?? 0) - now) / 1000));
  const isAccessExpired = accessRemainingSeconds === 0;

  const findFastestServer = useCallback(async () => {
    const candidates = [...BUILT_IN_SERVERS, ...state.customServers].filter((server) => server.id !== 'random-fastest' && Boolean(server.host) && server.host !== 'openvpn');
    if (candidates.length === 0) {
      setFastestStatus('unavailable');
      setFastestMessage('No configured hosts to measure.');
      return;
    }
    setFastestStatus('finding');
    setFastestMessage('Finding fastest server...');
    const timed = await Promise.all(candidates.map(async (server) => {
      const started = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        await fetch('https://' + server.host.replace(/^https?:\/\//i, ''), { method: 'HEAD', signal: controller.signal });
        return { server, ms: Date.now() - started };
      } catch {
        return { server, ms: Number.POSITIVE_INFINITY };
      } finally {
        clearTimeout(timeout);
      }
    }));
    const winner = timed.filter((item) => Number.isFinite(item.ms)).sort((a, b) => a.ms - b.ms)[0];
    if (!winner) {
      setFastestStatus('unavailable');
      setFastestMessage('No reachable hosts. Select a server manually.');
      return;
    }
    setState((current) => ({ ...current, selectedServerId: winner.server.id }));
    setFastestStatus('selected');
    setFastestMessage('Selected ' + winner.server.name + ' • ' + winner.ms + ' ms');
  }, [state.customServers]);

  const selectServer = useCallback((serverId: string) => {
    setFastestStatus('idle');
    setFastestMessage('');
    setState((current) => {
      const available = [...BUILT_IN_SERVERS.filter((server) => server.id !== 'random-fastest'), ...current.customServers];
      if (!available.some((server) => server.id === serverId)) return current;
      return { ...current, selectedServerId: serverId };
    });
  }, []);

  const selectConfig = useCallback((configId: string) => {
    setState((current) => {
      const available = [...BUILT_IN_TWEAKS, ...current.customTweaks];
      if (!available.some((config) => config.id === configId)) return current;
      return { ...current, selectedConfigId: configId };
    });
  }, []);
  const selectProfile = selectConfig;
  const toggleSetting = useCallback((key: keyof Settings) => setState((current) => ({ ...current, settings: { ...current.settings, [key]: !current.settings[key] } })), []);
  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => setState((current) => ({ ...current, settings: { ...current.settings, [key]: value } })), []);

  const requestConnection = useCallback(() => {
    setState((current) => {
      const server = current.selectedServerId ? servers.find((item) => item.id === current.selectedServerId) : undefined;
      const config = current.selectedConfigId ? configs.find((item) => item.id === current.selectedConfigId) : undefined;
      if (!server || !config) {
        return { ...current, status: 'failed', logs: [makeLog('FAILED', 'VPN connection failed'), makeLog('FAILED', 'Reason: Please select a server and configuration.'), ...current.logs].slice(0, 100) };
      }
      if (isAccessExpired) {
        return { ...current, status: 'failed', logs: [makeLog('FAILED', 'VPN connection failed'), makeLog('FAILED', 'Reason: Access expired.'), ...current.logs].slice(0, 100) };
      }
      return { ...current, status: 'failed', logs: [makeLog('FAILED', 'Reason: Android VpnService backend is not configured.'), makeLog('FAILED', 'VPN connection failed'), makeLog('CONNECTING', 'Connecting...'), makeLog('CONNECTING', 'Configuration: ' + config.name), makeLog('CONNECTING', 'Server: ' + server.name), makeLog('CONNECTING', 'Starting VPN connection...'), ...current.logs].slice(0, 100) };
    });
  }, [configs, isAccessExpired, servers]);

  const disconnect = useCallback(() => setState((current) => ({ ...current, status: 'disconnected', connectionStartedAt: null, logs: [makeLog('DISCONNECTED', 'VPN disconnected'), makeLog('DISCONNECTING', 'Disconnecting VPN...'), ...current.logs].slice(0, 100) })), []);

  const grantAccess = useCallback((hours: number) => setState((current) => {
    const base = Math.max(current.accessExpiresAt ?? 0, Date.now());
    return { ...current, accessExpiresAt: base + hours * 60 * 60 * 1000 };
  }), []);

  const addCustomServer = useCallback(async (input: CustomServerInput, sshUsername: string, sshPassword: string, privateKey: string) => {
    const id = 'custom-server-' + Date.now().toString();
    const server: Server = { ...input, id, latency: null, enabled: Boolean(input.host), isCustom: true, hasCredentials: Boolean(sshUsername || sshPassword), hasPrivateKey: Boolean(privateKey) };
    if (sshUsername) await SecureStore.setItemAsync(secureKey('username', id), sshUsername);
    if (sshPassword) await SecureStore.setItemAsync(secureKey('password', id), sshPassword);
    if (privateKey) await SecureStore.setItemAsync(secureKey('privateKey', id), privateKey);
    setState((current) => ({ ...current, customServers: [...current.customServers, server], selectedServerId: id }));
  }, []);

  const editCustomServer = useCallback(async (id: string, input: CustomServerInput, sshUsername: string, sshPassword: string, privateKey: string) => {
    const server: Server = { ...input, id, latency: null, enabled: Boolean(input.host), isCustom: true, hasCredentials: Boolean(sshUsername || sshPassword), hasPrivateKey: Boolean(privateKey) };
    if (sshUsername) await SecureStore.setItemAsync(secureKey('username', id), sshUsername);
    if (sshPassword) await SecureStore.setItemAsync(secureKey('password', id), sshPassword);
    if (privateKey) await SecureStore.setItemAsync(secureKey('privateKey', id), privateKey);
    setState((current) => ({ ...current, customServers: current.customServers.map((item) => item.id === id ? { ...server, hasCredentials: server.hasCredentials || item.hasCredentials, hasPrivateKey: server.hasPrivateKey || item.hasPrivateKey } : item) }));
  }, []);

  const deleteCustomServer = useCallback(async (id: string) => {
    await SecureStore.deleteItemAsync(secureKey('username', id));
    await SecureStore.deleteItemAsync(secureKey('password', id));
    await SecureStore.deleteItemAsync(secureKey('privateKey', id));
    setState((current) => ({ ...current, customServers: current.customServers.filter((item) => item.id !== id), selectedServerId: current.selectedServerId === id ? null : current.selectedServerId }));
  }, []);

  const testServer = useCallback((id: string) => {
    void id;
  }, []);

  const addCustomTweak = useCallback((input: CustomTweakInput) => setState((current) => {
    const id = 'custom-tweak-' + Date.now().toString();
    return { ...current, customTweaks: [...current.customTweaks, { ...input, id, provider: 'Local profile', enabled: Boolean(input.host), isCustom: true }], selectedConfigId: id };
  }), []);
  const editCustomTweak = useCallback((id: string, input: CustomTweakInput) => setState((current) => ({ ...current, customTweaks: current.customTweaks.map((item) => item.id === id ? { ...input, id, provider: 'Local profile', enabled: Boolean(input.host), isCustom: true } : item) })), []);
  const duplicateTweak = useCallback((id: string) => setState((current) => { const source = current.customTweaks.find((item) => item.id === id); return source ? { ...current, customTweaks: [...current.customTweaks, { ...source, id: 'custom-tweak-' + Date.now().toString(), name: source.name + ' Copy' }] } : current; }), []);
  const deleteCustomTweak = useCallback((id: string) => setState((current) => ({ ...current, customTweaks: current.customTweaks.filter((item) => item.id !== id), selectedConfigId: current.selectedConfigId === id ? null : current.selectedConfigId })), []);
  const testTweak = useCallback((id: string) => { void id; }, []);
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
       setState((current) => ({ ...current, configVersion: nextVersion }));
      return { success: true, message: 'Config updated to version ' + nextVersion + '.' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The config update failed.';
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

  const value = useMemo<AppStateContextValue>(() => ({ ...state, servers, configs, tweaks, accessRemainingSeconds, isAccessExpired, fastestStatus, fastestMessage, selectServer, findFastestServer, selectConfig, selectProfile, toggleSetting, updateSetting, requestConnection, disconnect, grantAccess, addCustomServer, editCustomServer, deleteCustomServer, testServer, addCustomTweak, editCustomTweak, duplicateTweak, deleteCustomTweak, testTweak, clearLogs, clearAppData, updateConfig }), [state, servers, configs, tweaks, accessRemainingSeconds, isAccessExpired, fastestStatus, fastestMessage, selectServer, findFastestServer, selectConfig, selectProfile, toggleSetting, updateSetting, requestConnection, disconnect, grantAccess, addCustomServer, editCustomServer, deleteCustomServer, testServer, addCustomTweak, editCustomTweak, duplicateTweak, deleteCustomTweak, testTweak, clearLogs, clearAppData, updateConfig]);
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useAppState must be used inside AppStateProvider');
  return value;
}

export const REWARDED_AD_TEST_ID = 'ca-app-pub-3940256099942544/5224354917';
export const RewardManager = { async showRewardedAd(): Promise<boolean> { return false; } };
