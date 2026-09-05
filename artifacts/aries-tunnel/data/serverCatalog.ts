import type { Server } from '@/context/AppStateContext';

// Location catalog only. Hosts remain empty until an operator-approved endpoint is configured.
// This prevents shipping third-party credentials or implying that a public server is authorized.
export const BUILT_IN_SERVERS: Server[] = [
  { id: 'random-fastest', name: 'Random / Fastest', country: 'Auto select', flag: 'AUTO', host: '', port: 0, protocol: 'Auto', provider: 'Aries Tunnel', source: 'Measures only configured authorized endpoints.', latency: null, enabled: true },
  { id: 'sg-1', name: 'Singapore', country: 'Singapore', flag: 'SG', host: '', port: 1194, protocol: 'OpenVPN', provider: 'Endpoint required', source: 'Add an operator-approved public endpoint before enabling.', latency: null, enabled: false },
  { id: 'us-1', name: 'United States', country: 'United States', flag: 'US', host: '', port: 1194, protocol: 'OpenVPN', provider: 'Endpoint required', source: 'Add an operator-approved public endpoint before enabling.', latency: null, enabled: false },
  { id: 'br-1', name: 'Brazil', country: 'Brazil', flag: 'BR', host: '', port: 1194, protocol: 'OpenVPN', provider: 'Endpoint required', source: 'Add an operator-approved public endpoint before enabling.', latency: null, enabled: false },
  { id: 'fr-1', name: 'France', country: 'France', flag: 'FR', host: '', port: 1194, protocol: 'OpenVPN', provider: 'Endpoint required', source: 'Add an operator-approved public endpoint before enabling.', latency: null, enabled: false },
  { id: 'de-1', name: 'Germany', country: 'Germany', flag: 'DE', host: '', port: 1194, protocol: 'OpenVPN', provider: 'Endpoint required', source: 'Add an operator-approved public endpoint before enabling.', latency: null, enabled: false },
  { id: 'nl-1', name: 'Netherlands', country: 'Netherlands', flag: 'NL', host: '', port: 1194, protocol: 'OpenVPN', provider: 'Endpoint required', source: 'Add an operator-approved public endpoint before enabling.', latency: null, enabled: false },
  { id: 'au-1', name: 'Australia', country: 'Australia', flag: 'AU', host: '', port: 1194, protocol: 'OpenVPN', provider: 'Endpoint required', source: 'Add an operator-approved public endpoint before enabling.', latency: null, enabled: false },
  { id: 'in-1', name: 'India', country: 'India', flag: 'IN', host: '', port: 1194, protocol: 'OpenVPN', provider: 'Endpoint required', source: 'Add an operator-approved public endpoint before enabling.', latency: null, enabled: false },
  { id: 'ca-1', name: 'Canada', country: 'Canada', flag: 'CA', host: '', port: 1194, protocol: 'OpenVPN', provider: 'Endpoint required', source: 'Add an operator-approved public endpoint before enabling.', latency: null, enabled: false },
];
