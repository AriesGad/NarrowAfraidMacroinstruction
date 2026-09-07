import * as Network from 'expo-network';
import type { Tweak } from '@/context/AppStateContext';

export type RemoteConfigResult = {
  success: boolean;
  configs: Tweak[];
  message: string;
  version: string;
};

const VALID_CONNECTION_TYPES = ['Direct SSH', 'SSL/TLS', 'HTTP', 'WebSocket'] as const;
type ConnectionType = (typeof VALID_CONNECTION_TYPES)[number];

/**
 * Extracts the JSON object from a raw string that may contain
 * extra text before/after the JSON (headers, markers, banners, etc.).
 */
function extractJson(raw: string): string {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return raw;
  return raw.slice(start, end + 1);
}

/**
 * Auto-fixes common JSON structural problems:
 * 1. Trailing commas before } or ]
 * 2. Single-quoted strings → double-quoted
 * 3. Unquoted object keys
 * 4. Missing closing brackets / braces
 * 5. JavaScript-style comments (// and /*)
 */
function autoFixJson(raw: string): string {
  let fixed = raw;

  // Strip JS-style comments
  fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '');
  fixed = fixed.replace(/(^|[^:])\/\/.*$/gm, '$1');

  // Remove trailing commas (before } or ])
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');

  // Replace single-quoted strings with double-quoted
  fixed = fixed.replace(/'([^']*)'/g, '"$1"');

  // Quote unquoted object keys (word: → "word":)
  fixed = fixed.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":');

  // Balance missing closing braces
  const opens = (fixed.match(/{/g) || []).length;
  const closes = (fixed.match(/}/g) || []).length;
  if (opens > closes) fixed += '}'.repeat(opens - closes);

  // Balance missing closing brackets
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/\]/g) || []).length;
  if (openBrackets > closeBrackets) fixed += ']'.repeat(openBrackets - closeBrackets);

  return fixed;
}

/**
 * Tries to parse JSON, falling back to auto-fix if the raw text is malformed.
 * Returns null if the JSON is completely unusable.
 */
function safeParse(raw: string): Record<string, unknown> | null {
  // 1. Direct parse
  try {
    const result = JSON.parse(raw);
    if (result && typeof result === 'object') return result as Record<string, unknown>;
  } catch { /* continue */ }

  // 2. Extract JSON from surrounding text, then parse
  const extracted = extractJson(raw);
  try {
    const result = JSON.parse(extracted);
    if (result && typeof result === 'object') return result as Record<string, unknown>;
  } catch { /* continue */ }

  // 3. Auto-fix extracted JSON, then parse
  const fixed = autoFixJson(extracted);
  try {
    const result = JSON.parse(fixed);
    if (result && typeof result === 'object') return result as Record<string, unknown>;
  } catch { /* continue */ }

  // 4. Auto-fix raw text (in case extraction missed something), then parse
  const fixedRaw = autoFixJson(raw);
  try {
    const result = JSON.parse(fixedRaw);
    if (result && typeof result === 'object') return result as Record<string, unknown>;
  } catch { /* completely unusable */ }

  return null;
}

function pickString(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function pickNumber(obj: Record<string, unknown>, fallback: number, ...keys: string[]): number {
  for (const key of keys) {
    const value = obj[key];
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

function normalizeConnectionType(value: unknown): ConnectionType {
  const str = String(value ?? '').trim();
  return (VALID_CONNECTION_TYPES as readonly string[]).includes(str) ? (str as ConnectionType) : 'Direct SSH';
}

/**
 * Normalizes a raw config item from the remote JSON into a Tweak.
 * Handles both the clean format and common alternative field names.
 */
function normalizeItem(raw: unknown, index: number): Tweak | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const name = pickString(obj, 'name', 'Name');
  if (!name) return null;

  const id = 'remote-' + (pickString(obj, 'id', 'Id') || index);
  const label = pickString(obj, 'label', 'Label', 'category', 'Category');
  const subtitle = pickString(obj, 'subtitle', 'Subtitle', 'note', 'Note', 'description', 'Description');

  return {
    id,
    name,
    country: pickString(obj, 'country', 'Country'),
    flag: pickString(obj, 'flag', 'Flag'),
    connectionType: normalizeConnectionType(obj.connectionType ?? obj.ConnectionType ?? obj.type),
    host: pickString(obj, 'host', 'Host', 'SSHHost', 'sshHost'),
    port: pickNumber(obj, 443, 'port', 'Port', 'SSHPort', 'sshPort'),
    sni: pickString(obj, 'sni', 'SNI', 'NameServer', 'nameServer'),
    proxyHost: pickString(obj, 'proxyHost', 'ProxyHost'),
    proxyPort: pickNumber(obj, 0, 'proxyPort', 'ProxyPort'),
    payloadConfiguration: pickString(obj, 'payloadConfiguration', 'Payload', 'payload'),
    provider: 'Remote config',
    enabled: true,
    category: label,
    note: subtitle,
  };
}

/**
 * Downloads remote configs from the given URL.
 * Handles offline state, malformed JSON, and normalizes the result.
 * Returns the parsed configs, a user-facing message, and a version string.
 */
export async function downloadRemoteConfigs(url: string): Promise<RemoteConfigResult> {
  // Check connectivity first
  try {
    const network = await Network.getNetworkStateAsync();
    if (!network.isConnected || network.isInternetReachable === false) {
      return { success: false, configs: [], message: 'No internet connection available. Try again when the device is online.', version: '' };
    }
  } catch {
    return { success: false, configs: [], message: 'Could not check network status.', version: '' };
  }

  // Download
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return { success: false, configs: [], message: 'Could not reach the config server. Check your connection and try again.', version: '' };
  }

  if (!response.ok) {
    return { success: false, configs: [], message: 'Config server returned HTTP ' + response.status + '.', version: '' };
  }

  const raw = await response.text();
  const parsed = safeParse(raw);

  if (!parsed) {
    return { success: false, configs: [], message: 'The config file is corrupted and could not be repaired automatically.', version: '' };
  }

  // Extract the configs array (handle multiple key names)
  const rawConfigs = parsed.configs ?? parsed.Configs ?? parsed.servers ?? parsed.Servers ?? parsed.tweaks ?? parsed.Tweaks;
  if (!Array.isArray(rawConfigs)) {
    return { success: false, configs: [], message: 'The config file does not contain a valid config list.', version: '' };
  }

  const configs = rawConfigs
    .map(normalizeItem)
    .filter((item): item is Tweak => item !== null);

  if (configs.length === 0) {
    return { success: false, configs: [], message: 'No valid configs found in the remote file.', version: '' };
  }

  const version = pickString(parsed, 'version', 'Version') || String(Date.now());
  const message = pickString(parsed, 'message', 'Message') || 'Configs updated to version ' + version + '.';

  return { success: true, configs, message, version };
}
