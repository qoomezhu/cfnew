export const backupIPs = [
  { domain: 'ProxyIP.US.CMLiussss.net', regionCode: 'US', port: 443 },
  { domain: 'ProxyIP.SG.CMLiussss.net', regionCode: 'SG', port: 443 },
  { domain: 'ProxyIP.JP.CMLiussss.net', regionCode: 'JP', port: 443 },
  { domain: 'ProxyIP.HK.CMLiussss.net', regionCode: 'HK', port: 443 },
  { domain: 'ProxyIP.KR.CMLiussss.net', regionCode: 'KR', port: 443 },
  { domain: 'ProxyIP.DE.CMLiussss.net', regionCode: 'DE', port: 443 },
  { domain: 'ProxyIP.SE.CMLiussss.net', regionCode: 'SE', port: 443 },
  { domain: 'ProxyIP.NL.CMLiussss.net', regionCode: 'NL', port: 443 },
  { domain: 'ProxyIP.FI.CMLiussss.net', regionCode: 'FI', port: 443 },
  { domain: 'ProxyIP.GB.CMLiussss.net', regionCode: 'GB', port: 443 },
];

export const directDomains = [
  { name: 'cloudflare.182682.xyz', domain: 'cloudflare.182682.xyz' },
  { name: 'speed.marisalnc.com', domain: 'speed.marisalnc.com' },
  { domain: 'freeyx.cloudflare88.eu.org' },
  { domain: 'bestcf.top' },
  { domain: 'cdn.2020111.xyz' },
  { domain: 'cfip.cfcdn.vip' },
  { domain: 'cloudflare.9jy.cc' },
  { domain: 'cloudflare-ip.mofashi.ltd' },
  { domain: 'cname.xirancdn.us' },
  { domain: 'cdn.tzpro.xyz' },
];

const countryToRegion = {
  US: 'US', SG: 'SG', JP: 'JP', HK: 'HK', KR: 'KR',
  DE: 'DE', SE: 'SE', NL: 'NL', FI: 'FI', GB: 'GB',
  CN: 'HK', TW: 'HK', MO: 'HK', AU: 'SG', CA: 'US',
  FR: 'DE', IT: 'DE', ES: 'DE', CH: 'DE', AT: 'DE',
  BE: 'NL', DK: 'SE', NO: 'SE', IE: 'GB', MY: 'SG',
  TH: 'SG', ID: 'SG', PH: 'SG'
};

export function normalizePath(input) {
  if (!input || input === '/') return '/';
  const path = String(input).trim();
  if (!path) return '/';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
}

export function getRouteBase(config) {
  if (config?.d) return normalizePath(config.d);
  return normalizePath(`/${config?.u || ''}`);
}

export function parseAddressAndPort(input) {
  if (!input) return { address: '', port: null };
  const value = String(input).trim();
  if (!value) return { address: '', port: null };

  if (value.startsWith('[')) {
    const match = value.match(/^\[([^\]]+)\](?::(\d+))?$/);
    if (match) {
      return {
        address: match[1],
        port: match[2] ? Number(match[2]) : null,
      };
    }
  }

  const lastColonIndex = value.lastIndexOf(':');
  if (lastColonIndex > 0) {
    const maybePort = value.slice(lastColonIndex + 1);
    if (/^\d+$/.test(maybePort)) {
      return {
        address: value.slice(0, lastColonIndex),
        port: Number(maybePort),
      };
    }
  }

  return { address: value, port: null };
}

export function wrapHostForUrl(host) {
  return host && host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}

export function isEnabled(value, defaultValue = true) {
  if (value == null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

export function isValidUUID(input) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(input || ''));
}

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

export function htmlResponse(html, status = 200, extraHeaders = {}) {
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

export function textResponse(text, status = 200, extraHeaders = {}) {
  return new Response(text, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

export function dedupeEndpoints(items = []) {
  const map = new Map();
  for (const item of items) {
    if (!item?.host || !item?.port) continue;
    const key = `${item.host}:${item.port}`;
    if (!map.has(key)) {
      map.set(key, {
        host: item.host,
        port: Number(item.port),
        name: item.name || `${item.host}:${item.port}`,
      });
    }
  }
  return Array.from(map.values());
}

export function parsePreferredList(input) {
  if (!input) return [];
  const text = String(input).replace(/\r/g, '\n');
  const rawItems = text.split(/[\n,]+/).map((line) => line.trim()).filter(Boolean);
  const parsed = [];

  for (const item of rawItems) {
    const [addressPart, ...nameParts] = item.split('#');
    const { address, port } = parseAddressAndPort(addressPart.trim());
    if (!address || !port) continue;
    parsed.push({
      host: address,
      port: Number(port),
      name: nameParts.join('#').trim() || `自定义优选-${address}:${port}`,
    });
  }

  return dedupeEndpoints(parsed);
}

export function safeJsonForHtml(data) {
  return JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
}

export function getNearbyRegions(region) {
  const nearbyMap = {
    US: ['SG', 'JP', 'HK', 'KR'],
    SG: ['JP', 'HK', 'KR', 'US'],
    JP: ['SG', 'HK', 'KR', 'US'],
    HK: ['SG', 'JP', 'KR', 'US'],
    KR: ['JP', 'HK', 'SG', 'US'],
    DE: ['NL', 'GB', 'SE', 'FI'],
    SE: ['DE', 'NL', 'FI', 'GB'],
    NL: ['DE', 'GB', 'SE', 'FI'],
    FI: ['SE', 'DE', 'NL', 'GB'],
    GB: ['DE', 'NL', 'SE', 'FI'],
  };
  return nearbyMap[region] || [];
}

export function pickBackupEndpoint(region, enableRegionMatching = true) {
  if (!enableRegionMatching || !region) return backupIPs[0] || null;
  const nearby = getNearbyRegions(region);
  const ordered = [region, ...nearby];
  for (const current of ordered) {
    const found = backupIPs.find((item) => item.regionCode === current);
    if (found) return found;
  }
  return backupIPs[0] || null;
}

export function detectRegion(request, manualRegion = '') {
  if (manualRegion && String(manualRegion).trim()) {
    return String(manualRegion).trim().toUpperCase();
  }

  const headerCountry = [
    request?.headers?.get?.('x-eo-country'),
    request?.headers?.get?.('x-geo-country'),
    request?.headers?.get?.('cf-ipcountry'),
    request?.headers?.get?.('x-vercel-ip-country'),
    request?.eo?.geo?.countryCode,
    request?.eo?.country,
  ].find(Boolean);

  const country = String(headerCountry || '').trim().toUpperCase();
  return countryToRegion[country] || 'HK';
}
