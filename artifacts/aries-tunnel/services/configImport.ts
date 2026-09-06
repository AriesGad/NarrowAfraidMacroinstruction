import type { V2RayProfile, V2RayProfileValues } from '@/context/AppStateContext';

export type ImportedV2Ray = {
  profile: V2RayProfile;
  values: V2RayProfileValues;
};

function decodeBase64(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const extra = padded.length % 4;
  const normalized = extra ? padded + '='.repeat(4 - extra) : padded;
  try {
    if (typeof atob === 'function') return atob(normalized);
  } catch {
    return '';
  }
  return '';
}

function queryMap(search: string) {
  const params = new URLSearchParams(search.startsWith('?') ? search : '?' + search);
  const values: Record<string, string> = {};
  params.forEach((value, key) => {
    values[key.toLowerCase()] = value;
  });
  return values;
}

function fromUrl(raw: string) {
  const parsed = new URL(raw);
  return { host: parsed.hostname, port: parsed.port, username: decodeURIComponent(parsed.username), password: decodeURIComponent(parsed.password), search: parsed.search, pathname: parsed.pathname, hash: parsed.hash };
}

export function parseV2RayImport(raw: string): ImportedV2Ray | null {
  const text = raw.trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  try {
    if (lower.startsWith('vless://')) {
      const url = fromUrl(text);
      const query = queryMap(url.search);
      return {
        profile: 'VLESS',
        values: {
          address: url.host,
          port: url.port || '443',
          uuid: url.username,
          encryption: query.encryption || 'none',
          flow: query.flow || 'none',
          network: query.type || query.network || 'tcp',
          security: query.security || 'none',
          sni: query.sni || query.servername || '',
          fingerprint: query.fp || query.fingerprint || '',
          publicKey: query.pbk || query.publickey || '',
          shortId: query.sid || query.shortid || '',
          path: query.path || url.pathname || '',
          host: query.host || '',
          serviceName: query.servicename || '',
        },
      };
    }
    if (lower.startsWith('vmess://')) {
      const decoded = decodeBase64(text.slice(8));
      const payload = JSON.parse(decoded) as Record<string, unknown>;
      return {
        profile: 'VMess',
        values: {
          address: String(payload.add ?? payload.address ?? ''),
          port: String(payload.port ?? ''),
          uuid: String(payload.id ?? ''),
          alterId: String(payload.aid ?? '0'),
          network: String(payload.net ?? payload.type ?? 'tcp'),
          security: payload.tls === 'tls' ? 'tls' : 'none',
          sni: String(payload.sni ?? payload.host ?? ''),
          host: String(payload.host ?? ''),
          path: String(payload.path ?? ''),
        },
      };
    }
    if (lower.startsWith('trojan://')) {
      const url = fromUrl(text);
      const query = queryMap(url.search);
      return {
        profile: 'Trojan',
        values: {
          address: url.host,
          port: url.port || '443',
          password: url.username,
          sni: query.sni || '',
          network: query.type || 'tcp',
          security: query.security || 'tls',
          path: query.path || '',
          host: query.host || '',
        },
      };
    }
    if (lower.startsWith('ss://')) {
      const body = text.slice(5);
      const [credHost, query = ''] = body.split('?');
      const at = credHost.lastIndexOf('@');
      const encoded = at >= 0 ? credHost.slice(0, at) : credHost;
      const hostPort = at >= 0 ? credHost.slice(at + 1) : '';
      const decoded = encoded.includes(':') ? encoded : decodeBase64(encoded);
      const [method, ...passwordParts] = decoded.split(':');
      const [address, port = ''] = hostPort.split(':');
      return {
        profile: 'Shadowsocks',
        values: { address, port, method, password: passwordParts.join(':'), network: queryMap(query).type || 'tcp' },
      };
    }
    if (lower.startsWith('socks://') || lower.startsWith('socks5://')) {
      const url = fromUrl(text.replace(/^socks5/i, 'socks'));
      return { profile: 'Socks', values: { address: url.host, port: url.port || '1080', username: url.username, password: url.password } };
    }
    if (lower.startsWith('http://') || lower.startsWith('https://')) {
      const url = fromUrl(text);
      return { profile: 'HTTP', values: { address: url.host, port: url.port || (lower.startsWith('https://') ? '443' : '80'), username: url.username, password: url.password } };
    }
    if (lower.startsWith('hysteria2://') || lower.startsWith('hy2://')) {
      const url = fromUrl(text.replace(/^hy2:/i, 'hysteria2:'));
      const query = queryMap(url.search);
      return { profile: 'Hysteria2', values: { address: url.host, port: url.port || '443', password: url.username, sni: query.sni || '', obfuscation: query.obfs || '', alpn: query.alpn || '' } };
    }
  } catch {
    return null;
  }
  return null;
}

export function buildV2RayPreview(profile: V2RayProfile, values: V2RayProfileValues) {
  return JSON.stringify({ profile, config: values }, null, 2);
}
