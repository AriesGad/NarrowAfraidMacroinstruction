import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'unavailable';

export type Server = {
  id: string;
  name: string;
  location: string;
  ping: number;
  available: boolean;
  isCustom?: boolean;
};

export type AppLog = {
  id: string;
  time: string;
  type: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'DNS' | 'NETWORK' | 'ERROR';
  message: string;
};

type Settings = {
  forwardUdp: boolean;
  notificationSound: boolean;
  vibrate: boolean;
  cpuWakelock: boolean;
  batteryOptimization: boolean;
  forwardDns: boolean;
  mobileNetwork: boolean;
  shareHotspot: boolean;
};

type AppStateData = {
  status: ConnectionStatus;
  selectedServerId: string;
  selectedProfile: string;
  accessExpiresAt: number | null;
  connectionStartedAt: number | null;
  settings: Settings;
  logs: AppLog[];
  customServer: Server | null;
};

type AppStateContextValue = AppStateData & {
  servers: Server[];
  accessRemainingSeconds: number;
  isAccessExpired: boolean;
  selectServer: (serverId: string) => void;
  selectProfile: (profile: string) => void;
  toggleSetting: (key: keyof Settings) => void;
  requestConnection: () => void;
  disconnect: () => void;
  grantAccess: (hours: number) => void;
  addCustomServer: (name: string, location: string) => void;
  clearLogs: () => void;
  clearAppData: () => void;
};

const STORAGE_KEY = 'aries-tunnel-state-v1';
const DEFAULT_SERVERS: Server[] = [
  { id: 'nyc-1', name: 'New York / 01', location: 'United States', ping: 24, available: true },
  { id: 'lon-1', name: 'London / 01', location: 'United Kingdom', ping: 86, available: true },
  { id: 'sin-1', name: 'Singapore / 01', location: 'Singapore', ping: 178, available: true },
];

const DEFAULT_STATE: AppStateData = {
  status: 'disconnected',
  selectedServerId: 'nyc-1',
  selectedProfile: 'Default',
  accessExpiresAt: null,
  connectionStartedAt: null,
  settings: {
    forwardUdp: true,
    notificationSound: true,
    vibrate: true,
    cpuWakelock: false,
    batteryOptimization: false,
    forwardDns: true,
    mobileNetwork: true,
    shareHotspot: false,
  },
  logs: [],
  customServer: null,
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

function makeLog(type: AppLog['type'], message: string): AppLog {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
    time: new Date().toISOString(),
    type,
    message,
  };
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppStateData>(DEFAULT_STATE);
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (!saved) return;
      try {
        const parsed = JSON.parse(saved) as Partial<AppStateData>;
        setState({ ...DEFAULT_STATE, ...parsed, settings: { ...DEFAULT_STATE.settings, ...parsed.settings } });
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
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined);
  }, [state]);

  const servers = useMemo(() => (state.customServer ? [...DEFAULT_SERVERS, state.customServer] : DEFAULT_SERVERS), [state.customServer]);
  const accessRemainingSeconds = Math.max(0, Math.floor(((state.accessExpiresAt ?? 0) - now) / 1000));
  const isAccessExpired = accessRemainingSeconds === 0;

  const selectServer = useCallback((serverId: string) => {
    setState((current) => ({ ...current, selectedServerId: serverId }));
  }, []);

  const selectProfile = useCallback((profile: string) => {
    setState((current) => ({ ...current, selectedProfile: profile }));
  }, []);

  const toggleSetting = useCallback((key: keyof Settings) => {
    setState((current) => ({ ...current, settings: { ...current.settings, [key]: !current.settings[key] } }));
  }, []);

  const requestConnection = useCallback(() => {
    setState((current) => {
      const message = isAccessExpired ? 'Access expired. Earn time before connecting.' : 'Tunnel backend not configured. No connection started.';
      return { ...current, status: 'unavailable', logs: [makeLog('ERROR', message), ...current.logs].slice(0, 100) };
    });
  }, [isAccessExpired]);

  const disconnect = useCallback(() => {
    setState((current) => ({
      ...current,
      status: 'disconnected',
      connectionStartedAt: null,
      logs: [makeLog('DISCONNECTED', 'Tunnel disconnected by user.'), ...current.logs].slice(0, 100),
    }));
  }, []);

  const grantAccess = useCallback((hours: number) => {
    setState((current) => {
      const base = Math.max(current.accessExpiresAt ?? 0, Date.now());
      return {
        ...current,
        accessExpiresAt: base + hours * 60 * 60 * 1000,
        logs: [makeLog('NETWORK', '+' + hours + ' hours VPN access added.'), ...current.logs].slice(0, 100),
      };
    });
  }, []);

  const addCustomServer = useCallback((name: string, location: string) => {
    const custom: Server = { id: 'custom-' + Date.now().toString(), name, location, ping: 0, available: false, isCustom: true };
    setState((current) => ({ ...current, customServer: custom, selectedServerId: custom.id, logs: [makeLog('NETWORK', 'Custom server saved locally.'), ...current.logs].slice(0, 100) }));
  }, []);

  const clearLogs = useCallback(() => setState((current) => ({ ...current, logs: [] })), []);
  const clearAppData = useCallback(() => setState(DEFAULT_STATE), []);

  const value = useMemo<AppStateContextValue>(() => ({
    ...state,
    servers,
    accessRemainingSeconds,
    isAccessExpired,
    selectServer,
    selectProfile,
    toggleSetting,
    requestConnection,
    disconnect,
    grantAccess,
    addCustomServer,
    clearLogs,
    clearAppData,
  }), [state, servers, accessRemainingSeconds, isAccessExpired, selectServer, selectProfile, toggleSetting, requestConnection, disconnect, grantAccess, addCustomServer, clearLogs, clearAppData]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useAppState must be used inside AppStateProvider');
  return value;
}

export const REWARDED_AD_TEST_ID = 'ca-app-pub-3940256099942544/5224354917';
export const RewardManager = {
  async showRewardedAd(): Promise<boolean> {
    return false;
  },
};
