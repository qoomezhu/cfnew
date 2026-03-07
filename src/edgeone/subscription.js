import { kvGetJson, kvPutJson, PREFERRED_IPS_KEY, ECH_CACHE_PREFIX } from './store.js';
import {
  dedupeEndpoints,
  directDomains,
  isEnabled,
  parsePreferredList,
  wrapHostForUrl,
} from './utils.js';

const DEFAULT_GITHUB_PREFERRED_URL = 'https://raw.githubusercontent.com/qwer-search/bestip/refs/heads/main/kejilandbestip.txt';
const DEFAULT_DOH_CANDIDATES = [
  'https://dns.google/dns-query',
  'https://cloudflare-dns.com/dns-query',
];

function splitCommaList(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function getDoHCandidates(config) {
  const values = splitCommaList(config.doh);
  const ordered = [];
  const seen = new Set();
  for (const value of [...values, ...DEFAULT_DOH_CANDIDATES]) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    ordered.push(value);
  }
  return ordered;
}

function getPrimaryDoH(config) {
  return getDoHCandidates(config)[0] || DEFAULT_DOH_CANDIDATES[0];
}

function buildECHCacheKey(config) {
  const raw = `${config.echDomain || 'cloudflare-ech.com'}|${getDoHCandidates(config).join(',')}`;
  return ECH_CACHE_PREFIX + Buffer.from(raw).toString('base64url');
}

function buildDoHProbeUrl(baseUrl, domain) {
  const url = new URL(baseUrl);
  if (!url.searchParams.has('name')) url.searchParams.set('name', domain);
  if (!url.searchParams.has('type')) url.searchParams.set('type', '65');
  return url.toString();
}

async function probeSingleDoH(baseUrl, domain) {
  const probeUrl = buildDoHProbeUrl(baseUrl, domain);
  try {
    const response = await fetch(probeUrl, {
      headers: { accept: 'application/dns-json, application/json, text/plain, */*' },
    });

    if (!response.ok) {
      return {
        status: 'FAILED',
        domain,
        doh: baseUrl,
        usedDoH: baseUrl,
        detail: `DoH 请求失败: ${response.status}`,
        sample: '',
      };
    }

    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}

    if (json && Array.isArray(json.Answer)) {
      const answers = json.Answer.filter((item) => item && (item.type === 65 || item.data));
      if (answers.length > 0) {
        return {
          status: 'SUCCESS',
          domain,
          doh: baseUrl,
          usedDoH: baseUrl,
          detail: `DoH 返回 ${answers.length} 条 Answer 记录`,
          sample: text.slice(0, 240),
        };
      }
      return {
        status: 'UNKNOWN',
        domain,
        doh: baseUrl,
        usedDoH: baseUrl,
        detail: 'DoH 已响应，但未返回可识别的 Answer 记录',
        sample: text.slice(0, 240),
      };
    }

    const lower = text.toLowerCase();
    const hasECH = lower.includes('ech=') || lower.includes('echconfig') || lower.includes('echconfiglist');
    return {
      status: hasECH ? 'SUCCESS' : 'UNKNOWN',
      domain,
      doh: baseUrl,
      usedDoH: baseUrl,
      detail: hasECH ? '文本响应中识别到 ECH 相关字段' : 'DoH 已响应，但未在文本中识别到 ECH 字段',
      sample: text.slice(0, 240),
    };
  } catch (error) {
    return {
      status: 'FAILED',
      domain,
      doh: baseUrl,
      usedDoH: baseUrl,
      detail: `DoH 探测异常: ${error.message}`,
      sample: '',
    };
  }
}

export function buildWsPath(config) {
  const params = new URLSearchParams({ ed: '2048' });
  if (config.p) params.set('p', config.p);
  if (!config.p && config.wk) params.set('wk', config.wk.toLowerCase());
  if (config.s) params.set('s', config.s);
  if (String(config.rm).toLowerCase() === 'no') params.set('rm', 'no');
  return `/?${params.toString()}`;
}

export function buildXhttpPath(config) {
  return `/${String(config.u || '').replace(/-/g, '').slice(0, 8)}`;
}

function buildEchValue(config) {
  const echDomain = config.echDomain || 'cloudflare-ech.com';
  const doh = getPrimaryDoH(config);
  return `${echDomain}+${doh}`;
}

export async function inspectECH(context, config, options = {}) {
  const force = Boolean(options.force);
  if (!isEnabled(config.ech, false)) {
    return {
      enabled: false,
      status: 'DISABLED',
      domain: config.echDomain || 'cloudflare-ech.com',
      doh: getPrimaryDoH(config),
      usedDoH: '',
      detail: 'ECH 未启用',
      source: 'config',
      cachedAt: null,
      expiresAt: null,
    };
  }

  const ttlSeconds = Math.max(60, Number(config.echCacheTTL || 3600));
  const cacheKey = buildECHCacheKey(config);
  const now = Date.now();

  if (!force) {
    const cached = await kvGetJson(context, cacheKey, null);
    if (cached?.expiresAt && cached.expiresAt > now) {
      return {
        ...cached,
        source: 'cache',
      };
    }
  }

  const domain = config.echDomain || 'cloudflare-ech.com';
  const candidates = getDoHCandidates(config);
  let best = null;

  for (const candidate of candidates) {
    const current = await probeSingleDoH(candidate, domain);
    if (!best) best = current;
    if (current.status === 'SUCCESS') {
      best = current;
      break;
    }
    if (best.status !== 'SUCCESS' && current.status === 'UNKNOWN') {
      best = current;
    }
  }

  const result = {
    enabled: true,
    status: best?.status || 'FAILED',
    domain,
    doh: candidates.join(', '),
    usedDoH: best?.usedDoH || candidates[0] || '',
    detail: best?.detail || '没有可用的 DoH 响应',
    sample: best?.sample || '',
    source: 'network',
    cachedAt: now,
    expiresAt: now + ttlSeconds * 1000,
    cacheTTL: ttlSeconds,
  };

  try {
    await kvPutJson(context, cacheKey, result);
  } catch {}

  return result;
}

function toName(sourceName, port, protoLabel) {
  return `${sourceName}-${port}-${protoLabel}`;
}

function buildVlessLink(endpoint, config, workerDomain) {
  const wsPath = buildWsPath(config);
  const params = new URLSearchParams({
    encryption: 'none',
    security: 'tls',
    type: 'ws',
    host: workerDomain,
    sni: workerDomain,
    fp: isEnabled(config.ech, false) ? 'chrome' : 'randomized',
    alpn: 'h3,h2,http/1.1',
    path: wsPath,
  });
  if (isEnabled(config.ech, false)) {
    params.set('ech', buildEchValue(config));
  }
  const host = wrapHostForUrl(endpoint.host);
  const name = encodeURIComponent(toName(endpoint.name, endpoint.port, 'VLESS-WS-TLS'));
  return `vless://${config.u}@${host}:${endpoint.port}?${params.toString()}#${name}`;
}

function buildTrojanLink(endpoint, config, workerDomain) {
  const wsPath = buildWsPath(config);
  const password = encodeURIComponent(config.tp || config.u);
  const params = new URLSearchParams({
    security: 'tls',
    type: 'ws',
    host: workerDomain,
    sni: workerDomain,
    alpn: 'h3,h2,http/1.1',
    path: wsPath,
    fp: 'chrome',
  });
  if (isEnabled(config.ech, false)) {
    params.set('ech', buildEchValue(config));
  }
  const host = wrapHostForUrl(endpoint.host);
  const name = encodeURIComponent(toName(endpoint.name, endpoint.port, 'Trojan-WS-TLS'));
  return `trojan://${password}@${host}:${endpoint.port}?${params.toString()}#${name}`;
}

function buildXhttpLink(endpoint, config, workerDomain) {
  const host = wrapHostForUrl(endpoint.host);
  const name = encodeURIComponent(toName(endpoint.name, endpoint.port, 'VLESS-xhttp-TLS'));
  const params = new URLSearchParams({
    encryption: 'none',
    security: 'tls',
    type: 'xhttp',
    host: workerDomain,
    sni: workerDomain,
    fp: 'chrome',
    mode: 'stream-one',
    path: buildXhttpPath(config),
    alpn: 'h3,h2,http/1.1',
  });
  if (isEnabled(config.ech, false)) {
    params.set('ech', buildEchValue(config));
  }
  return `vless://${config.u}@${host}:${endpoint.port}?${params.toString()}#${name}`;
}

async function fetchRemotePreferredList(url) {
  try {
    const response = await fetch(url, { headers: { accept: 'text/plain,*/*' } });
    if (!response.ok) return [];
    const text = await response.text();
    return parsePreferredList(text.replace(/\r/g, '\n').replace(/,/g, '\n'));
  } catch {
    return [];
  }
}

async function collectEndpoints(context, config, workerDomain) {
  const endpoints = [{ host: workerDomain, port: 443, name: '原生地址' }];

  if (!isEnabled(config.yxby, false)) {
    const kvPreferred = await kvGetJson(context, PREFERRED_IPS_KEY, []);
    const customPreferred = parsePreferredList(config.yx);

    if (isEnabled(config.epd, true)) {
      endpoints.push(...directDomains.map((item) => ({
        host: item.domain,
        port: 443,
        name: item.name || item.domain,
      })));
    }

    endpoints.push(...customPreferred);
    endpoints.push(...(Array.isArray(kvPreferred) ? kvPreferred : []));

    if (config.yxURL) {
      endpoints.push(...await fetchRemotePreferredList(config.yxURL));
    } else if (isEnabled(config.egi, true)) {
      endpoints.push(...await fetchRemotePreferredList(DEFAULT_GITHUB_PREFERRED_URL));
    }
  }

  return dedupeEndpoints(endpoints);
}

export async function generateBase64Subscription(request, context, config) {
  const url = new URL(request.url);
  const workerDomain = url.hostname;
  const endpoints = await collectEndpoints(context, config, workerDomain);
  const links = [];

  for (const endpoint of endpoints) {
    if (isEnabled(config.ev, true)) {
      links.push(buildVlessLink(endpoint, config, workerDomain));
    }
    if (isEnabled(config.et, false)) {
      links.push(buildTrojanLink(endpoint, config, workerDomain));
    }
    if (isEnabled(config.ex, false)) {
      links.push(buildXhttpLink(endpoint, config, workerDomain));
    }
  }

  if (!links.length) {
    const errorLink = 'vless://00000000-0000-4000-8000-000000000000@127.0.0.1:443?encryption=none&security=tls&type=ws&host=error.local&path=%2F#empty';
    links.push(errorLink);
  }

  return btoa(links.join('\n'));
}

export function buildClientLinks(request, config) {
  const url = new URL(request.url);
  const routeBase = config.d ? config.d : `/${config.u}`;
  const baseSubUrl = `${url.origin}${routeBase}/sub`;
  const converterBase = config.scu || 'https://url.v1.mk/sub';

  const makeConverter = (target) => `${converterBase}?target=${encodeURIComponent(target)}&url=${encodeURIComponent(baseSubUrl)}&insert=false`;

  return {
    raw: baseSubUrl,
    converterBase,
    wsPath: buildWsPath(config),
    xhttpPath: buildXhttpPath(config),
    echEnabled: isEnabled(config.ech, false),
    echDomain: config.echDomain || 'cloudflare-ech.com',
    echPrimaryDoh: getPrimaryDoH(config),
    echCacheTTL: Number(config.echCacheTTL || 3600),
    clients: {
      base64: baseSubUrl,
      clash: makeConverter('clash'),
      surge: makeConverter('surge'),
      singbox: makeConverter('singbox'),
      loon: makeConverter('loon'),
      quanx: makeConverter('quanx'),
      stash: makeConverter('clash'),
      v2ray: baseSubUrl,
      shadowrocket: `shadowrocket://add/${encodeURIComponent(baseSubUrl)}`,
      v2rayng: `v2rayng://install?url=${encodeURIComponent(baseSubUrl)}`,
      nekoray: `nekoray://install-config?url=${encodeURIComponent(baseSubUrl)}`,
    },
  };
}
