import type { Tweak } from '@/context/AppStateContext';

export const BUILT_IN_TWEAKS: Tweak[] = [
  { id: 'tweak-sg-stable', name: 'Singapore Stable', country: 'Singapore', flag: 'SG', connectionType: 'SSL/TLS', host: '', port: 443, sni: '', proxyHost: '', proxyPort: 0, payloadConfiguration: '', provider: 'Template only', enabled: false },
  { id: 'tweak-us-fast', name: 'USA Fast', country: 'United States', flag: 'US', connectionType: 'Direct SSH', host: '', port: 22, sni: '', proxyHost: '', proxyPort: 0, payloadConfiguration: '', provider: 'Template only', enabled: false },
  { id: 'tweak-fr-low-data', name: 'France Low Data', country: 'France', flag: 'FR', connectionType: 'HTTP', host: '', port: 80, sni: '', proxyHost: '', proxyPort: 0, payloadConfiguration: '', provider: 'Template only', enabled: false },
];
