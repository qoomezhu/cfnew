import { kvGetJson, PREFERRED_IPS_KEY } from './store.js';
import {
  dedupeEndpoints,
  directDomains,
  isEnabled,
  parsePreferredList,
  wrapHostForUrl,
} from './utils.js';

const DEFAULT_GITHUB_PREFERRED_URL = 'https://raw.githubusercontent.com/qwer-search/bestip/refs/heads/main/kejilandbestip.txt';

function buildWsPath(config) {
  const params = new URLSearchParams({ ed: '2048' });
  if (config.p) params.set('p', config.p);
  if (!config.p && config.wk) params.set('wk', config.wk.toLowerCase());
  if (config.s) params.set('s', config.s);
  if (String(config.rm).toLowerCase() === 'no') params.set('rm', 'no');
  return `/?${params.toString()}`;
}

function buildXhttpPath(config) {
  return `/${String(config.u || '').replace(/-/g, '').slice(0, 8)}`;
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
    fp: 'randomized',
    alpn: 'h3,h2,http/1.1',
    path: wsPath,
  });
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
  });
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
    xhttpPath: buildXhttpPath(config),
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
