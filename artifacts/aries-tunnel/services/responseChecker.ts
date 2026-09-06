export type ResponseCheckInput = {
  host: string;
  port: string;
  sni: string;
  proxyHost: string;
  proxyPort: string;
  customHeaders: string;
  method: 'GET' | 'POST' | 'HEAD' | 'DELETE' | 'OPTIONS' | 'PATCH';
  proxyEnabled?: boolean;
  ipInfoEnabled?: boolean;
  cdnFinderEnabled?: boolean;
};

export type ResponseCheckResult = {
  reachable: boolean;
  statusCode: number | null;
  responseTime: number | null;
  tlsStatus: string;
  hostnameResult: string;
  redirect: string;
  headers: string[];
  ipInfo?: string;
  cdnInfo?: string;
  error?: string;
};

function buildUrl(input: ResponseCheckInput) {
  const value = input.host.trim();
  if (!value) throw new Error('Enter a host or URL first.');
  const withScheme = /^https?:\/\//i.test(value) ? value : 'https://' + value;
  if (!input.port.trim()) return withScheme;
  try {
    const parsed = new URL(withScheme);
    if (!parsed.port) parsed.port = input.port.trim();
    return parsed.toString();
  } catch {
    return withScheme;
  }
}

function parseHeaders(raw: string) {
  const headers: Record<string, string> = {};
  raw.split('\n').forEach((line) => {
    const separator = line.indexOf(':');
    if (separator > 0) {
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      if (key && value) headers[key] = value;
    }
  });
  return headers;
}

export async function checkEndpoint(input: ResponseCheckInput): Promise<ResponseCheckResult> {
  const url = buildUrl(input);
  if (input.proxyEnabled && !input.proxyHost.trim()) throw new Error('Enter a proxy host or turn Proxy off.');
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { method: input.method, headers: parseHeaders(input.customHeaders), signal: controller.signal, redirect: 'follow' });
    const responseTime = Date.now() - started;
    const headerSummary = ['content-type', 'server', 'location'].map((name) => {
      const value = response.headers.get(name);
      return value ? name + ': ' + value : '';
    }).filter(Boolean);
    const cdnHeader = ['cf-ray', 'cf-cache-status', 'x-cache', 'x-served-by', 'via', 'server'].find((name) => response.headers.get(name));
    let ipInfo: string | undefined;
    if (input.ipInfoEnabled) {
      try {
        const hostname = new URL(url).hostname;
        const dnsResponse = await fetch('https://dns.google/resolve?name=' + encodeURIComponent(hostname) + '&type=A', { headers: { accept: 'application/dns-json' }, signal: controller.signal });
        const dnsPayload = await dnsResponse.json() as { Answer?: Array<{ data?: string }> };
        const addresses = (dnsPayload.Answer ?? []).map((answer) => answer.data).filter((address): address is string => Boolean(address));
        ipInfo = addresses.length ? addresses.join(', ') : 'No public IPv4 address returned';
      } catch {
        ipInfo = 'DNS lookup unavailable';
      }
    }
    return {
      reachable: true,
      statusCode: response.status,
      responseTime,
      tlsStatus: url.toLowerCase().startsWith('https://') ? 'TLS negotiated; certificate details unavailable in Expo.' : 'Not applicable',
      hostnameResult: input.sni.trim() ? 'SNI requested: ' + input.sni.trim() : 'Default hostname used',
      redirect: response.url !== url ? 'Redirected to ' + response.url : 'No redirect detected',
      headers: headerSummary,
      ipInfo,
      cdnInfo: input.cdnFinderEnabled ? (cdnHeader ? 'Detected via ' + cdnHeader : 'No common CDN headers detected') : undefined,
    };
  } catch (error) {
    return {
      reachable: false,
      statusCode: null,
      responseTime: Date.now() - started,
      tlsStatus: url.toLowerCase().startsWith('https://') ? 'TLS unavailable or handshake failed' : 'Not applicable',
      hostnameResult: input.sni.trim() ? 'SNI requested: ' + input.sni.trim() : 'Not evaluated',
      redirect: 'Not available',
      headers: [],
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}
